import type { Context } from '../context.js';
import { NotFoundError, ValidationError } from '../errors.js';
import { requireOrg, requireProjectAccess } from './auth.js';
import { getEventBus } from '../../infrastructure/eventbus/index.js';
import { createChildLogger } from '../../utils/logger.js';

const log = createChildLogger('session-resolver');

const VALID_AUTONOMY_LEVELS = ['full', 'approve_external', 'approve_all'];
const VALID_FAILURE_POLICIES = ['retry_then_pause', 'pause_immediately', 'skip_and_continue'];
export interface SessionConfigInput {
  autonomyLevel: string;
  budgetCapCents?: number | null;
  failurePolicy: string;
  maxRetries?: number | null;
  scopeLimit?: number | null;
  timeLimitMinutes?: number | null;
}

// ── Queries ──

export const sessionQueries = {
  sessions: async (
    _parent: unknown,
    args: { projectId: string },
    context: Context,
  ) => {
    const { user } = await requireProjectAccess(context, args.projectId);
    return context.prisma.session.findMany({
      where: { projectId: args.projectId, orgId: user.orgId },
      orderBy: { createdAt: 'desc' },
    });
  },

  session: async (
    _parent: unknown,
    args: { sessionId: string },
    context: Context,
  ) => {
    const user = requireOrg(context);
    const session = await context.prisma.session.findUnique({
      where: { id: args.sessionId },
    });
    if (!session || session.orgId !== user.orgId) return null;
    return session;
  },
};

// ── Mutations ──

export const sessionMutations = {
  createSession: async (
    _parent: unknown,
    args: { projectId: string; taskIds: string[]; config: SessionConfigInput },
    context: Context,
  ) => {
    const { user } = await requireProjectAccess(context, args.projectId);

    if (!args.taskIds.length) {
      throw new ValidationError('At least one task ID is required');
    }

    // Validate config
    if (!VALID_AUTONOMY_LEVELS.includes(args.config.autonomyLevel)) {
      throw new ValidationError(`Invalid autonomyLevel. Must be one of: ${VALID_AUTONOMY_LEVELS.join(', ')}`);
    }
    if (!VALID_FAILURE_POLICIES.includes(args.config.failurePolicy)) {
      throw new ValidationError(`Invalid failurePolicy. Must be one of: ${VALID_FAILURE_POLICIES.join(', ')}`);
    }

    // Validate all taskIds belong to this project
    const tasks = await context.prisma.task.findMany({
      where: {
        taskId: { in: args.taskIds },
        projectId: args.projectId,
        orgId: user.orgId,
      },
      select: { taskId: true },
    });
    const foundIds = new Set(tasks.map(t => t.taskId));
    const missing = args.taskIds.filter(id => !foundIds.has(id));
    if (missing.length > 0) {
      throw new ValidationError(`Tasks not found in project: ${missing.join(', ')}`);
    }

    return context.prisma.session.create({
      data: {
        projectId: args.projectId,
        orgId: user.orgId,
        createdById: user.userId,
        status: 'draft',
        config: JSON.stringify(args.config),
        taskIds: JSON.stringify(args.taskIds),
        progress: JSON.stringify({
          tasksCompleted: 0,
          tasksFailed: 0,
          tasksSkipped: 0,
          tokensUsed: 0,
          estimatedCostCents: 0,
        }),
      },
    });
  },

  startSession: async (
    _parent: unknown,
    args: { sessionId: string },
    context: Context,
  ) => {
    const user = requireOrg(context);
    const session = await context.prisma.session.findUnique({
      where: { id: args.sessionId },
    });
    if (!session || session.orgId !== user.orgId) {
      throw new NotFoundError('Session not found');
    }
    if (session.status !== 'draft' && session.status !== 'paused') {
      throw new ValidationError(`Cannot start session with status '${session.status}'. Must be 'draft' or 'paused'.`);
    }

    // Check no other running session for this project
    const existing = await context.prisma.session.findFirst({
      where: { projectId: session.projectId, status: 'running', id: { not: session.id } },
    });
    if (existing) {
      throw new ValidationError('Another session is already running for this project');
    }

    const taskIds = JSON.parse(session.taskIds) as string[];

    // Mark included tasks as autoComplete
    await context.prisma.task.updateMany({
      where: { taskId: { in: taskIds }, projectId: session.projectId },
      data: { autoComplete: true },
    });

    const updated = await context.prisma.session.update({
      where: { id: args.sessionId },
      data: { status: 'running', startedAt: new Date(), pausedAt: null },
    });

    // Emit session.started event to trigger orchestration
    const bus = getEventBus();
    bus.emit('session.started', {
      orgId: session.orgId,
      userId: user.userId,
      projectId: session.projectId,
      timestamp: new Date().toISOString(),
      sessionId: session.id,
    });

    log.info({ sessionId: session.id, projectId: session.projectId, taskCount: taskIds.length }, 'Session started');

    return updated;
  },

  pauseSession: async (
    _parent: unknown,
    args: { sessionId: string },
    context: Context,
  ) => {
    const user = requireOrg(context);
    const session = await context.prisma.session.findUnique({
      where: { id: args.sessionId },
    });
    if (!session || session.orgId !== user.orgId) {
      throw new NotFoundError('Session not found');
    }
    if (session.status !== 'running') {
      throw new ValidationError(`Cannot pause session with status '${session.status}'. Must be 'running'.`);
    }

    const updated = await context.prisma.session.update({
      where: { id: args.sessionId },
      data: { status: 'paused', pausedAt: new Date() },
    });

    const bus = getEventBus();
    bus.emit('session.paused', {
      orgId: session.orgId,
      userId: user.userId,
      projectId: session.projectId,
      timestamp: new Date().toISOString(),
      sessionId: session.id,
    });

    log.info({ sessionId: session.id }, 'Session paused');

    return updated;
  },

  cancelSession: async (
    _parent: unknown,
    args: { sessionId: string },
    context: Context,
  ) => {
    const user = requireOrg(context);
    const session = await context.prisma.session.findUnique({
      where: { id: args.sessionId },
    });
    if (!session || session.orgId !== user.orgId) {
      throw new NotFoundError('Session not found');
    }
    if (session.status === 'completed' || session.status === 'cancelled') {
      throw new ValidationError(`Cannot cancel session with status '${session.status}'.`);
    }

    const taskIds = JSON.parse(session.taskIds) as string[];

    // Cancel any running action plans for session tasks
    await context.prisma.taskActionPlan.updateMany({
      where: {
        taskId: { in: taskIds },
        status: { in: ['pending', 'running'] },
      },
      data: { status: 'cancelled' },
    });

    const updated = await context.prisma.session.update({
      where: { id: args.sessionId },
      data: { status: 'cancelled', completedAt: new Date() },
    });

    log.info({ sessionId: session.id }, 'Session cancelled');

    return updated;
  },
};

// ── Field Resolvers ──

export interface SessionRow {
  id: string;
  config: string;
  progress: string | null;
  taskIds: string;
  createdAt: Date;
  startedAt: Date | null;
  pausedAt: Date | null;
  completedAt: Date | null;
}

export const sessionFieldResolvers = {
  Session: {
    config: (parent: SessionRow) => JSON.parse(parent.config),
    progress: (parent: SessionRow) => parent.progress ? JSON.parse(parent.progress) : null,
    taskIds: (parent: SessionRow) => JSON.parse(parent.taskIds),
    createdAt: (parent: SessionRow) => parent.createdAt.toISOString(),
    startedAt: (parent: SessionRow) => parent.startedAt?.toISOString() ?? null,
    pausedAt: (parent: SessionRow) => parent.pausedAt?.toISOString() ?? null,
    completedAt: (parent: SessionRow) => parent.completedAt?.toISOString() ?? null,
  },
};
