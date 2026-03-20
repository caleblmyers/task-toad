import type { Context } from '../context.js';
import { planTaskActions as aiPlanTaskActions } from '../../ai/index.js';
import type { PromptLogContext } from '../../ai/index.js';
import { NotFoundError, ValidationError } from '../errors.js';
import { requireOrg, requireApiKey } from './auth.js';
import { checkBudget, type BudgetStatus } from '../../ai/aiUsageTracker.js';
import { getProjectRepo } from '../../github/index.js';
import { availableTypes } from '../../actions/index.js';
import { getJobQueue } from '../../infrastructure/jobqueue/index.js';
import { retrieveRelevantKnowledge } from '../../ai/knowledgeRetrieval.js';
import { createChildLogger } from '../../utils/logger.js';

const log = createChildLogger('taskaction-resolver');

async function buildPromptLogContext(context: Context): Promise<PromptLogContext> {
  const user = requireOrg(context);
  const org = await context.prisma.org.findUnique({
    where: { orgId: user.orgId },
    select: { promptLoggingEnabled: true },
  });
  return {
    prisma: context.prisma,
    orgId: user.orgId,
    userId: user.userId,
    promptLoggingEnabled: org?.promptLoggingEnabled ?? true,
  };
}

async function enforceBudget(context: Context): Promise<BudgetStatus> {
  const user = requireOrg(context);
  return checkBudget(context.prisma, user.orgId);
}

// ── Queries ──

export const taskActionQueries = {
  taskActionPlan: async (_parent: unknown, args: { taskId: string }, context: Context) => {
    const user = requireOrg(context);
    const task = await context.loaders.taskById.load(args.taskId);
    if (!task || task.orgId !== user.orgId) throw new NotFoundError('Task not found');

    return context.prisma.taskActionPlan.findFirst({
      where: { taskId: args.taskId, orgId: user.orgId },
      orderBy: { createdAt: 'desc' },
      include: { actions: { orderBy: { position: 'asc' } } },
    });
  },

  taskActionHistory: async (_parent: unknown, args: { taskId: string }, context: Context) => {
    const user = requireOrg(context);
    const task = await context.loaders.taskById.load(args.taskId);
    if (!task || task.orgId !== user.orgId) throw new NotFoundError('Task not found');

    return context.prisma.taskActionPlan.findMany({
      where: { taskId: args.taskId, orgId: user.orgId },
      orderBy: { createdAt: 'desc' },
      include: { actions: { orderBy: { position: 'asc' } } },
    });
  },

  projectActionPlans: async (
    _parent: unknown,
    args: { projectId: string; status?: string },
    context: Context,
  ) => {
    const user = requireOrg(context);
    const project = await context.loaders.projectById.load(args.projectId);
    if (!project || project.orgId !== user.orgId) throw new NotFoundError('Project not found');

    return context.prisma.taskActionPlan.findMany({
      where: {
        task: { projectId: args.projectId },
        orgId: user.orgId,
        ...(args.status ? { status: args.status } : {}),
      },
      include: {
        actions: { orderBy: { position: 'asc' } },
        task: {
          select: {
            taskId: true,
            title: true,
            status: true,
            taskType: true,
            autoComplete: true,
            parentTask: { select: { title: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  },
};

// ── Mutations ──

export const taskActionMutations = {
  previewActionPlan: async (_parent: unknown, args: { taskId: string }, context: Context) => {
    const user = requireOrg(context);
    const apiKey = requireApiKey(context);
    await enforceBudget(context);

    const task = await context.loaders.taskById.load(args.taskId);
    if (!task || task.orgId !== user.orgId) throw new NotFoundError('Task not found');
    if (!task.instructions) {
      throw new ValidationError('Task has no instructions. Generate instructions first.');
    }

    const project = await context.loaders.projectById.load(task.projectId);
    if (!project) throw new NotFoundError('Project not found');

    const repo = await getProjectRepo(task.projectId);
    const plc = await buildPromptLogContext(context);

    // Retrieve relevant KB context for the task
    let knowledgeBase: string | null = null;
    try {
      const taskContext = `${task.title}. ${task.instructions || task.description || ''}`.slice(0, 500);
      const kbResult = await retrieveRelevantKnowledge(context.prisma, task.projectId, taskContext, apiKey);
      knowledgeBase = kbResult || null;
    } catch (err) {
      log.warn({ err, taskId: task.taskId }, 'KB retrieval failed for action plan, falling back to legacy');
    }
    if (!knowledgeBase && project.knowledgeBase) {
      knowledgeBase = project.knowledgeBase;
    }

    const result = await aiPlanTaskActions(
      apiKey,
      {
        taskTitle: task.title,
        taskDescription: task.description ?? '',
        taskInstructions: task.instructions,
        acceptanceCriteria: task.acceptanceCriteria,
        suggestedTools: task.suggestedTools,
        projectName: project.name,
        projectDescription: project.description,
        knowledgeBase,
        hasGitHubRepo: !!repo,
        availableActionTypes: availableTypes(),
      },
      plc,
    );

    return {
      actions: result.actions.map((a) => ({
        actionType: a.actionType,
        label: a.label,
        config: JSON.stringify(a.config),
        requiresApproval: a.requiresApproval,
        reasoning: a.reasoning,
      })),
      summary: result.summary,
    };
  },

  commitActionPlan: async (
    _parent: unknown,
    args: { taskId: string; actions: Array<{ actionType: string; label: string; config: string; requiresApproval: boolean }> },
    context: Context,
  ) => {
    const user = requireOrg(context);
    const task = await context.loaders.taskById.load(args.taskId);
    if (!task || task.orgId !== user.orgId) throw new NotFoundError('Task not found');

    if (args.actions.length === 0) {
      throw new ValidationError('Action plan must have at least one action');
    }

    // Cancel any existing draft/executing plans for this task
    await context.prisma.taskActionPlan.updateMany({
      where: { taskId: args.taskId, status: { in: ['draft', 'approved', 'executing'] } },
      data: { status: 'cancelled' },
    });

    const plan = await context.prisma.taskActionPlan.create({
      data: {
        taskId: args.taskId,
        orgId: user.orgId,
        status: 'approved',
        createdById: user.userId,
        actions: {
          create: args.actions.map((a, i) => ({
            actionType: a.actionType,
            label: a.label,
            config: a.config,
            position: i,
            requiresApproval: a.requiresApproval,
          })),
        },
      },
      include: { actions: { orderBy: { position: 'asc' } } },
    });

    return plan;
  },

  executeActionPlan: async (_parent: unknown, args: { planId: string }, context: Context) => {
    const user = requireOrg(context);
    const plan = await context.prisma.taskActionPlan.findUnique({
      where: { id: args.planId },
      include: { actions: { orderBy: { position: 'asc' } } },
    });

    if (!plan || plan.orgId !== user.orgId) throw new NotFoundError('Action plan not found');
    if (plan.status !== 'approved' && plan.status !== 'failed') {
      throw new ValidationError(`Cannot execute plan in '${plan.status}' status`);
    }

    // When retrying a failed plan, reset failed actions to pending
    if (plan.status === 'failed') {
      await context.prisma.taskAction.updateMany({
        where: { planId: args.planId, status: 'failed' },
        data: { status: 'pending', errorMessage: null, startedAt: null, completedAt: null },
      });
    }

    // Update status
    await context.prisma.taskActionPlan.update({
      where: { id: args.planId },
      data: { status: 'executing' },
    });

    // Re-fetch actions after potential reset
    const freshPlan = await context.prisma.taskActionPlan.findUnique({
      where: { id: args.planId },
      include: { actions: { orderBy: { position: 'asc' } } },
    });

    // Enqueue the first pending action
    const firstAction = freshPlan!.actions.find((a) => a.status === 'pending');
    if (firstAction) {
      const queue = getJobQueue();
      queue.enqueue('action-execute', {
        planId: args.planId,
        actionId: firstAction.id,
        orgId: user.orgId,
        userId: user.userId,
      });
    }

    return context.prisma.taskActionPlan.findUnique({
      where: { id: args.planId },
      include: { actions: { orderBy: { position: 'asc' } } },
    });
  },

  completeManualAction: async (_parent: unknown, args: { actionId: string }, context: Context) => {
    const user = requireOrg(context);
    const action = await context.prisma.taskAction.findUnique({
      where: { id: args.actionId },
      include: { plan: true },
    });

    if (!action || action.plan.orgId !== user.orgId) throw new NotFoundError('Action not found');
    if (action.actionType !== 'manual_step') {
      throw new ValidationError('Only manual_step actions can be completed manually');
    }
    if (action.status !== 'pending' && action.status !== 'executing') {
      throw new ValidationError(`Cannot complete action in '${action.status}' status`);
    }

    const updated = await context.prisma.taskAction.update({
      where: { id: args.actionId },
      data: { status: 'completed', completedAt: new Date() },
    });

    // Enqueue next action if plan is executing
    if (action.plan.status === 'executing') {
      const nextAction = await context.prisma.taskAction.findFirst({
        where: { planId: action.planId, status: 'pending', position: { gt: action.position } },
        orderBy: { position: 'asc' },
      });

      if (nextAction && !nextAction.requiresApproval) {
        const queue = getJobQueue();
        queue.enqueue('action-execute', {
          planId: action.planId,
          actionId: nextAction.id,
          orgId: action.plan.orgId,
          userId: user.userId,
        });
      } else if (!nextAction) {
        // All done
        await context.prisma.taskActionPlan.update({
          where: { id: action.planId },
          data: { status: 'completed' },
        });
      }
    }

    return updated;
  },

  skipAction: async (_parent: unknown, args: { actionId: string }, context: Context) => {
    const user = requireOrg(context);
    const action = await context.prisma.taskAction.findUnique({
      where: { id: args.actionId },
      include: { plan: true },
    });

    if (!action || action.plan.orgId !== user.orgId) throw new NotFoundError('Action not found');
    if (action.status !== 'pending') {
      throw new ValidationError(`Cannot skip action in '${action.status}' status`);
    }

    const updated = await context.prisma.taskAction.update({
      where: { id: args.actionId },
      data: { status: 'skipped' },
    });

    // Enqueue next action if plan is executing
    if (action.plan.status === 'executing') {
      const nextAction = await context.prisma.taskAction.findFirst({
        where: { planId: action.planId, status: 'pending', position: { gt: action.position } },
        orderBy: { position: 'asc' },
      });

      if (nextAction && !nextAction.requiresApproval) {
        const queue = getJobQueue();
        queue.enqueue('action-execute', {
          planId: action.planId,
          actionId: nextAction.id,
          orgId: action.plan.orgId,
          userId: user.userId,
        });
      } else if (!nextAction) {
        await context.prisma.taskActionPlan.update({
          where: { id: action.planId },
          data: { status: 'completed' },
        });
      }
    }

    return updated;
  },

  retryAction: async (_parent: unknown, args: { actionId: string }, context: Context) => {
    const user = requireOrg(context);
    const action = await context.prisma.taskAction.findUnique({
      where: { id: args.actionId },
      include: { plan: true },
    });

    if (!action || action.plan.orgId !== user.orgId) throw new NotFoundError('Action not found');
    if (action.status !== 'failed') {
      throw new ValidationError(`Cannot retry action in '${action.status}' status`);
    }

    // Reset action to pending
    const updated = await context.prisma.taskAction.update({
      where: { id: args.actionId },
      data: { status: 'pending', errorMessage: null, startedAt: null, completedAt: null },
    });

    // Reset plan to executing if it was failed
    if (action.plan.status === 'failed') {
      await context.prisma.taskActionPlan.update({
        where: { id: action.planId },
        data: { status: 'executing' },
      });
    }

    // Enqueue the action
    const queue = getJobQueue();
    queue.enqueue('action-execute', {
      planId: action.planId,
      actionId: args.actionId,
      orgId: action.plan.orgId,
      userId: user.userId,
    });

    return updated;
  },

  cancelActionPlan: async (_parent: unknown, args: { planId: string }, context: Context) => {
    const user = requireOrg(context);
    const plan = await context.prisma.taskActionPlan.findUnique({
      where: { id: args.planId },
    });

    if (!plan || plan.orgId !== user.orgId) throw new NotFoundError('Action plan not found');
    if (plan.status === 'completed' || plan.status === 'cancelled') {
      throw new ValidationError(`Cannot cancel plan in '${plan.status}' status`);
    }

    // Cancel pending/executing actions
    await context.prisma.taskAction.updateMany({
      where: { planId: args.planId, status: { in: ['pending', 'executing'] } },
      data: { status: 'skipped' },
    });

    return context.prisma.taskActionPlan.update({
      where: { id: args.planId },
      data: { status: 'cancelled' },
      include: { actions: { orderBy: { position: 'asc' } } },
    });
  },
};

// ── Field resolvers ──

export const taskActionFieldResolvers = {
  TaskActionPlan: {
    createdAt: (parent: { createdAt: Date }) => parent.createdAt.toISOString(),
    updatedAt: (parent: { updatedAt: Date }) => parent.updatedAt.toISOString(),
    task: (parent: { task?: { taskId: string; title: string; status: string; taskType: string | null; autoComplete: boolean; parentTask?: { title: string } | null } }) => {
      if (!parent.task) return null;
      return {
        taskId: parent.task.taskId,
        title: parent.task.title,
        status: parent.task.status,
        taskType: parent.task.taskType,
        autoComplete: parent.task.autoComplete,
        parentTaskTitle: parent.task.parentTask?.title ?? null,
      };
    },
  },
  TaskAction: {
    createdAt: (parent: { createdAt: Date }) => parent.createdAt.toISOString(),
    startedAt: (parent: { startedAt: Date | null }) => parent.startedAt?.toISOString() ?? null,
    completedAt: (parent: { completedAt: Date | null }) => parent.completedAt?.toISOString() ?? null,
  },
};
