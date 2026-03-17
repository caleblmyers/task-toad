import type { PrismaClient } from '@prisma/client';
import { createChildLogger } from '../../utils/logger.js';
import { getExecutor } from '../../actions/index.js';
import type { ActionType, ActionContext } from '../../actions/types.js';
import { checkBudget } from '../../ai/aiUsageTracker.js';
import { getEventBus } from '../eventbus/index.js';
import { getJobQueue } from '../jobqueue/index.js';

const log = createChildLogger('action-executor');

export function createHandler(prisma: PrismaClient) {
  return async (payload: { planId: string; actionId: string; orgId: string; userId: string }) => {
    const { planId, actionId, orgId, userId } = payload;

    // Load action + plan + task + project
    const action = await prisma.taskAction.findUnique({
      where: { id: actionId },
      include: {
        plan: {
          include: {
            task: {
              include: {
                project: true,
              },
            },
          },
        },
      },
    });

    if (!action || action.plan.status === 'cancelled') {
      log.warn({ actionId, planId }, 'Action not found or plan cancelled');
      return;
    }

    if (action.status !== 'pending') {
      log.warn({ actionId, status: action.status }, 'Action not in pending state');
      return;
    }

    const task = action.plan.task;
    const project = task.project;

    // Check budget for AI-consuming actions
    const actionType = action.actionType as ActionType;
    if (actionType === 'generate_code' || actionType === 'write_docs') {
      const budget = await checkBudget(prisma, orgId);
      if (!budget.allowed) {
        await prisma.taskAction.update({
          where: { id: actionId },
          data: { status: 'failed', errorMessage: 'AI budget exceeded' },
        });
        await prisma.taskActionPlan.update({
          where: { id: planId },
          data: { status: 'failed' },
        });
        return;
      }
    }

    // Get the executor
    const executor = getExecutor(actionType);
    if (!executor) {
      await prisma.taskAction.update({
        where: { id: actionId },
        data: { status: 'failed', errorMessage: `Unknown action type: ${actionType}` },
      });
      return;
    }

    // Build previous results map
    const previousActions = await prisma.taskAction.findMany({
      where: { planId, status: 'completed', position: { lt: action.position } },
      orderBy: { position: 'asc' },
    });
    const previousResults = new Map<string, unknown>();
    for (const prev of previousActions) {
      if (prev.result) {
        try {
          previousResults.set(prev.id, JSON.parse(prev.result));
        } catch {
          // ignore parse errors
        }
      }
    }

    // Get API key from org (decrypt if present)
    const org = await prisma.org.findUnique({
      where: { orgId },
      select: { anthropicApiKeyEncrypted: true },
    });

    let apiKey = '';
    if (org?.anthropicApiKeyEncrypted) {
      const { decryptApiKey } = await import('../../utils/encryption.js');
      try {
        apiKey = decryptApiKey(org.anthropicApiKeyEncrypted);
      } catch {
        log.warn({ orgId }, 'Failed to decrypt API key');
      }
    }

    const ctx: ActionContext = {
      action: { id: action.id, actionType: action.actionType, config: action.config, label: action.label },
      task: { taskId: task.taskId, title: task.title, description: task.description, instructions: task.instructions, projectId: task.projectId },
      project: { projectId: project.projectId, name: project.name, description: project.description, knowledgeBase: project.knowledgeBase },
      apiKey,
      prisma,
      previousResults,
    };

    // Mark as executing
    await prisma.taskAction.update({
      where: { id: actionId },
      data: { status: 'executing', startedAt: new Date() },
    });

    try {
      const result = await executor.execute(ctx);

      if (result.success) {
        await prisma.taskAction.update({
          where: { id: actionId },
          data: {
            status: 'completed',
            result: JSON.stringify(result.data),
            completedAt: new Date(),
          },
        });
      } else {
        await prisma.taskAction.update({
          where: { id: actionId },
          data: {
            status: 'failed',
            errorMessage: (result.data.error as string) || 'Action failed',
          },
        });
      }

      // Emit action completed event
      const bus = getEventBus();
      bus.emit('task.action_completed', {
        orgId,
        userId,
        projectId: task.projectId,
        timestamp: new Date().toISOString(),
        actionId,
        actionType: action.actionType,
        planId,
        taskId: task.taskId,
        success: result.success,
      });

      if (!result.success) {
        await prisma.taskActionPlan.update({
          where: { id: planId },
          data: { status: 'failed' },
        });
        return;
      }

      // Check if there's a next action to enqueue
      const nextAction = await prisma.taskAction.findFirst({
        where: { planId, status: 'pending', position: { gt: action.position } },
        orderBy: { position: 'asc' },
      });

      if (nextAction) {
        if (nextAction.requiresApproval) {
          // Pause — user must approve via the UI
          log.info({ planId, nextActionId: nextAction.id }, 'Next action requires approval, pausing');
        } else {
          // Auto-enqueue next action
          const queue = getJobQueue();
          queue.enqueue('action-execute', {
            planId,
            actionId: nextAction.id,
            orgId,
            userId,
          });
        }
      } else {
        // All done
        await prisma.taskActionPlan.update({
          where: { id: planId },
          data: { status: 'completed' },
        });
        bus.emit('task.action_plan_completed', {
          orgId,
          userId,
          projectId: task.projectId,
          timestamp: new Date().toISOString(),
          planId,
          taskId: task.taskId,
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      log.error({ err, actionId, planId }, 'Action execution failed');

      await prisma.taskAction.update({
        where: { id: actionId },
        data: { status: 'failed', errorMessage },
      });
      await prisma.taskActionPlan.update({
        where: { id: planId },
        data: { status: 'failed' },
      });

      const bus = getEventBus();
      bus.emit('task.action_completed', {
        orgId,
        userId,
        projectId: task.projectId,
        timestamp: new Date().toISOString(),
        actionId,
        actionType: action.actionType,
        planId,
        taskId: task.taskId,
        success: false,
      });
    }
  };
}
