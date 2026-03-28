import type { PrismaClient, TaskActionPlan, TaskAction } from '@prisma/client';

/** Config keys that may contain AI placeholder IDs needing remapping. */
const PLACEHOLDER_CONFIG_KEYS = ['sourceActionId', 'sourcePRActionId', 'sourceMonitorActionId', 'sourceReviewActionId'];

interface ActionInput {
  actionType: string;
  label: string;
  config: string;
  requiresApproval: boolean;
}

interface CreatePlanOptions {
  status?: string;
}

/**
 * Create an action plan with actions and remap AI placeholder IDs (action_0, action_1, ...)
 * to real database UUIDs in action configs.
 */
export async function createPlanWithActions(
  prisma: PrismaClient,
  taskId: string,
  orgId: string,
  userId: string,
  actions: ActionInput[],
  options?: CreatePlanOptions,
): Promise<{ plan: TaskActionPlan; actions: TaskAction[] }> {
  const plan = await prisma.taskActionPlan.create({
    data: {
      taskId,
      orgId,
      status: options?.status ?? 'approved',
      createdById: userId,
      actions: {
        create: actions.map((a, i) => ({
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

  // Remap AI placeholder IDs to real database UUIDs
  const idMap = new Map<string, string>();
  plan.actions.forEach((a, i) => idMap.set(`action_${i}`, a.id));

  for (const action of plan.actions) {
    let config: Record<string, unknown>;
    try { config = JSON.parse(action.config || '{}'); } catch { continue; }
    let changed = false;
    for (const key of PLACEHOLDER_CONFIG_KEYS) {
      const ref = config[key] as string | undefined;
      if (ref && idMap.has(ref)) {
        config[key] = idMap.get(ref);
        changed = true;
      }
    }
    if (changed) {
      await prisma.taskAction.update({
        where: { id: action.id },
        data: { config: JSON.stringify(config) },
      });
    }
  }

  // Re-fetch with updated configs
  const result = await prisma.taskActionPlan.findUniqueOrThrow({
    where: { id: plan.id },
    include: { actions: { orderBy: { position: 'asc' } } },
  });

  return { plan: result, actions: result.actions };
}
