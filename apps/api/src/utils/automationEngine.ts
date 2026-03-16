import type { PrismaClient } from '@prisma/client';
import { createChildLogger } from './logger.js';
import { createNotification } from './notification.js';

const log = createChildLogger('automation');

interface AutomationEvent {
  type: string;
  projectId: string;
  orgId: string;
  taskId?: string;
  userId?: string;
  data: Record<string, unknown>;
}

interface TriggerCondition {
  event: string;
  condition?: Record<string, unknown>;
}

interface AutomationAction {
  type: 'notify_assignee' | 'move_to_column' | 'set_status' | 'assign_to';
  column?: string;
  status?: string;
  userId?: string;
}

export function executeAutomations(prisma: PrismaClient, event: AutomationEvent): void {
  // Fire-and-forget — don't block the caller
  doExecuteAutomations(prisma, event).catch((err: unknown) => {
    log.error({ err, event: event.type }, 'Automation execution failed');
  });
}

async function doExecuteAutomations(prisma: PrismaClient, event: AutomationEvent): Promise<void> {
  const rules = await prisma.automationRule.findMany({
    where: { projectId: event.projectId, enabled: true },
  });

  for (const rule of rules) {
    try {
      const trigger = JSON.parse(rule.trigger) as TriggerCondition;
      if (trigger.event !== event.type) continue;

      // Check conditions
      if (trigger.condition) {
        let matches = true;
        for (const [key, value] of Object.entries(trigger.condition)) {
          if (event.data[key] !== value) {
            matches = false;
            break;
          }
        }
        if (!matches) continue;
      }

      const action = JSON.parse(rule.action) as AutomationAction;
      await executeAction(prisma, event, action);
      log.info({ ruleId: rule.id, ruleName: rule.name, action: action.type }, 'Automation rule fired');
    } catch (err) {
      log.warn({ err, ruleId: rule.id }, 'Failed to evaluate/execute automation rule');
    }
  }
}

async function executeAction(
  prisma: PrismaClient,
  event: AutomationEvent,
  action: AutomationAction,
): Promise<void> {
  const { taskId, orgId, projectId } = event;

  switch (action.type) {
    case 'notify_assignee': {
      if (!taskId) return;
      const task = await prisma.task.findUnique({ where: { taskId } });
      if (!task?.assigneeId) return;
      createNotification(prisma, {
        orgId,
        userId: task.assigneeId,
        type: 'automation',
        title: `Automation triggered on "${task.title}"`,
        linkUrl: `/app/projects/${projectId}`,
        relatedTaskId: taskId,
        relatedProjectId: projectId,
      });
      break;
    }
    case 'move_to_column': {
      if (!taskId || !action.column) return;
      await prisma.task.update({
        where: { taskId },
        data: { sprintColumn: action.column },
      });
      break;
    }
    case 'set_status': {
      if (!taskId || !action.status) return;
      await prisma.task.update({
        where: { taskId },
        data: { status: action.status },
      });
      break;
    }
    case 'assign_to': {
      if (!taskId || !action.userId) return;
      await prisma.task.update({
        where: { taskId },
        data: { assigneeId: action.userId },
      });
      break;
    }
  }
}
