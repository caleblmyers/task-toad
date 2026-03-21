import type { SLAPolicy, SLATimer } from '@prisma/client';
import type { Context } from '../context.js';
import { NotFoundError, ValidationError } from '../errors.js';
import { requireOrg, requireProjectAccess } from './auth.js';

export const slaQueries = {
  slaPolicies: async (
    _parent: unknown,
    args: { projectId: string },
    context: Context,
  ) => {
    await requireProjectAccess(context, args.projectId);
    const policies = await context.prisma.sLAPolicy.findMany({
      where: { projectId: args.projectId },
      orderBy: { createdAt: 'asc' },
    });
    return policies.map(formatPolicy);
  },

  taskSLAStatus: async (
    _parent: unknown,
    args: { taskId: string },
    context: Context,
  ) => {
    const user = requireOrg(context);
    const task = await context.prisma.task.findFirst({
      where: { taskId: args.taskId, orgId: user.orgId },
    });
    if (!task) throw new NotFoundError('Task not found');

    const timers = await context.prisma.sLATimer.findMany({
      where: { taskId: args.taskId },
      include: { policy: true },
    });
    return timers.map(formatTimer);
  },
};

export const slaMutations = {
  createSLAPolicy: async (
    _parent: unknown,
    args: {
      projectId: string;
      name: string;
      responseTimeHours: number;
      resolutionTimeHours: number;
      priority?: string | null;
    },
    context: Context,
  ) => {
    const { user } = await requireProjectAccess(context, args.projectId);
    if (args.responseTimeHours < 1) throw new ValidationError('responseTimeHours must be at least 1');
    if (args.resolutionTimeHours < 1) throw new ValidationError('resolutionTimeHours must be at least 1');
    if (args.resolutionTimeHours < args.responseTimeHours) {
      throw new ValidationError('resolutionTimeHours must be >= responseTimeHours');
    }

    const policy = await context.prisma.sLAPolicy.create({
      data: {
        projectId: args.projectId,
        orgId: user.orgId,
        name: args.name,
        responseTimeHours: args.responseTimeHours,
        resolutionTimeHours: args.resolutionTimeHours,
        priority: args.priority ?? null,
        enabled: true,
      },
    });
    return formatPolicy(policy);
  },

  updateSLAPolicy: async (
    _parent: unknown,
    args: {
      slaPolicyId: string;
      name?: string | null;
      responseTimeHours?: number | null;
      resolutionTimeHours?: number | null;
      priority?: string | null;
      enabled?: boolean | null;
    },
    context: Context,
  ) => {
    const user = requireOrg(context);
    const existing = await context.prisma.sLAPolicy.findFirst({
      where: { slaPolicyId: args.slaPolicyId, orgId: user.orgId },
    });
    if (!existing) throw new NotFoundError('SLA policy not found');

    const data: Record<string, unknown> = {};
    if (args.name != null) data.name = args.name;
    if (args.responseTimeHours != null) {
      if (args.responseTimeHours < 1) throw new ValidationError('responseTimeHours must be at least 1');
      data.responseTimeHours = args.responseTimeHours;
    }
    if (args.resolutionTimeHours != null) {
      if (args.resolutionTimeHours < 1) throw new ValidationError('resolutionTimeHours must be at least 1');
      data.resolutionTimeHours = args.resolutionTimeHours;
    }
    if (args.priority !== undefined) data.priority = args.priority;
    if (args.enabled != null) data.enabled = args.enabled;

    const policy = await context.prisma.sLAPolicy.update({
      where: { slaPolicyId: args.slaPolicyId },
      data,
    });
    return formatPolicy(policy);
  },

  deleteSLAPolicy: async (
    _parent: unknown,
    args: { slaPolicyId: string },
    context: Context,
  ) => {
    const user = requireOrg(context);
    const existing = await context.prisma.sLAPolicy.findFirst({
      where: { slaPolicyId: args.slaPolicyId, orgId: user.orgId },
    });
    if (!existing) throw new NotFoundError('SLA policy not found');

    await context.prisma.sLAPolicy.delete({
      where: { slaPolicyId: args.slaPolicyId },
    });
    return true;
  },
};

export const slaFieldResolvers = {
  SLATimer: {
    startedAt: (parent: { startedAt: Date | string }) =>
      parent.startedAt instanceof Date ? parent.startedAt.toISOString() : parent.startedAt,
    respondedAt: (parent: { respondedAt: Date | string | null }) =>
      parent.respondedAt instanceof Date ? parent.respondedAt.toISOString() : parent.respondedAt,
    resolvedAt: (parent: { resolvedAt: Date | string | null }) =>
      parent.resolvedAt instanceof Date ? parent.resolvedAt.toISOString() : parent.resolvedAt,
  },
};

// ── Helpers ──

function formatPolicy(p: SLAPolicy) {
  return { ...p, createdAt: p.createdAt.toISOString() };
}

function formatTimer(t: SLATimer & { policy: SLAPolicy }) {
  const now = Date.now();
  const startMs = t.startedAt.getTime();
  const responseDeadline = startMs + t.policy.responseTimeHours * 3600_000;
  const resolutionDeadline = startMs + t.policy.resolutionTimeHours * 3600_000;

  const timeToResponseHours = t.respondedAt
    ? null // already responded
    : (responseDeadline - now) / 3600_000;

  const timeToResolutionHours = t.resolvedAt
    ? null // already resolved
    : (resolutionDeadline - now) / 3600_000;

  return {
    ...t,
    startedAt: t.startedAt.toISOString(),
    respondedAt: t.respondedAt?.toISOString() ?? null,
    resolvedAt: t.resolvedAt?.toISOString() ?? null,
    policy: formatPolicy(t.policy),
    timeToResponseHours,
    timeToResolutionHours,
  };
}
