import type { PrismaClient } from '@prisma/client';
import { createChildLogger } from './logger.js';
import { automationRuleExecutionTotal } from './metrics.js';
import { createNotification } from './notification.js';
import { TriggerConditionSchema, MultiActionSchema, type TriggerCondition, type AutomationAction, type CompoundCondition } from './zodSchemas.js';

const log = createChildLogger('automation');

interface AutomationEvent {
  type: string;
  projectId: string;
  orgId: string;
  taskId?: string;
  userId?: string;
  data: Record<string, unknown>;
}

export function executeAutomations(prisma: PrismaClient, event: AutomationEvent): void {
  // Fire-and-forget — don't block the caller
  doExecuteAutomations(prisma, event).catch((err: unknown) => {
    log.error({ err, event: event.type }, 'Automation execution failed');
  });
}

/**
 * Evaluate a condition against event data.
 * Supports both simple {key: value} conditions and compound {operator, conditions} format.
 */
function matchesCondition(
  condition: TriggerCondition['condition'],
  data: Record<string, unknown>,
): boolean {
  if (!condition) return true;

  // Compound condition: {operator: 'AND'|'OR', conditions: [...]}
  if ('operator' in condition && 'conditions' in condition) {
    const compound = condition as CompoundCondition;
    if (compound.operator === 'AND') {
      return compound.conditions.every((c) => {
        if ('operator' in c && 'conditions' in c) {
          return matchesCondition(c as CompoundCondition, data);
        }
        const entry = c as { field: string; op: 'eq' | 'not_eq'; value: unknown };
        return entry.op === 'eq'
          ? data[entry.field] === entry.value
          : data[entry.field] !== entry.value;
      });
    }
    // OR
    return compound.conditions.some((c) => {
      if ('operator' in c && 'conditions' in c) {
        return matchesCondition(c as CompoundCondition, data);
      }
      const entry = c as { field: string; op: 'eq' | 'not_eq'; value: unknown };
      return entry.op === 'eq'
        ? data[entry.field] === entry.value
        : data[entry.field] !== entry.value;
    });
  }

  // Simple condition: {key: value} — existing behavior
  for (const [key, value] of Object.entries(condition)) {
    if (data[key] !== value) return false;
  }
  return true;
}

async function doExecuteAutomations(prisma: PrismaClient, event: AutomationEvent): Promise<void> {
  const rules = await prisma.automationRule.findMany({
    where: { projectId: event.projectId, enabled: true },
  });

  for (const rule of rules) {
    try {
      const triggerParse = TriggerConditionSchema.safeParse(JSON.parse(rule.trigger));
      if (!triggerParse.success) {
        log.warn({ ruleId: rule.id, error: triggerParse.error.message }, 'Invalid automation trigger JSON');
        continue;
      }
      const trigger: TriggerCondition = triggerParse.data;
      if (trigger.event !== event.type) continue;

      // Check conditions (simple or compound)
      if (!matchesCondition(trigger.condition, event.data)) continue;

      // Parse actions — supports single action or array of actions
      const actionParse = MultiActionSchema.safeParse(JSON.parse(rule.action));
      if (!actionParse.success) {
        log.warn({ ruleId: rule.id, error: actionParse.error.message }, 'Invalid automation action JSON');
        continue;
      }
      const actions: AutomationAction[] = Array.isArray(actionParse.data)
        ? actionParse.data
        : [actionParse.data];

      for (const action of actions) {
        await executeAction(prisma, event, action);
      }
      log.info({ ruleId: rule.id, ruleName: rule.name, actionCount: actions.length }, 'Automation rule fired');
      automationRuleExecutionTotal.inc({ status: 'success' });
    } catch (err) {
      automationRuleExecutionTotal.inc({ status: 'error' });
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
      // Verify target user belongs to same org before assigning
      const targetUser = await prisma.user.findUnique({
        where: { userId: action.userId },
        select: { orgId: true },
      });
      if (!targetUser || targetUser.orgId !== orgId) {
        log.warn({ userId: action.userId, orgId }, 'Automation assign_to: target user not in org');
        return;
      }
      await prisma.task.update({
        where: { taskId },
        data: { assigneeId: action.userId },
      });
      break;
    }
    case 'send_webhook': {
      if (!taskId || !action.url) return;
      const webhookTask = await prisma.task.findUnique({ where: { taskId } });
      if (!webhookTask) return;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        await fetch(action.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: event.type,
            timestamp: new Date().toISOString(),
            task: {
              taskId: webhookTask.taskId,
              title: webhookTask.title,
              status: webhookTask.status,
              priority: webhookTask.priority,
              projectId: webhookTask.projectId,
            },
          }),
          signal: controller.signal,
        });
      } catch (err) {
        log.warn({ err, url: action.url }, 'Automation send_webhook failed');
      } finally {
        clearTimeout(timeout);
      }
      break;
    }
    case 'add_label': {
      if (!taskId || !action.labelId) return;
      // Verify label exists in the org before applying
      const label = await prisma.label.findFirst({
        where: { labelId: action.labelId, orgId },
      });
      if (!label) {
        log.warn({ labelId: action.labelId, orgId }, 'Automation add_label: label not found in org');
        return;
      }
      // Skip if label already applied
      const existing = await prisma.taskLabel.findUnique({
        where: { taskId_labelId: { taskId, labelId: action.labelId } },
      });
      if (!existing) {
        await prisma.taskLabel.create({
          data: { taskId, labelId: action.labelId },
        });
      }
      break;
    }
    case 'add_comment': {
      if (!taskId || !action.content) return;
      const commentUserId = event.userId;
      if (!commentUserId) return;
      await prisma.comment.create({
        data: {
          taskId,
          userId: commentUserId,
          content: action.content,
        },
      });
      break;
    }
    case 'set_due_date': {
      if (!taskId || action.daysFromNow == null) return;
      await prisma.task.update({
        where: { taskId },
        data: { dueDate: new Date(Date.now() + action.daysFromNow * 86400000).toISOString().split('T')[0] },
      });
      break;
    }
  }
}
