import type { Context } from '../../context.js';
import type { PromptLogContext } from '../../../ai/index.js';
import { AuthorizationError, ValidationError } from '../../errors.js';
import { requireOrg } from '../auth.js';
import { checkBudget, type BudgetStatus } from '../../../ai/aiUsageTracker.js';
import { auditLog } from '../../../utils/auditLog.js';

/**
 * Prisma filter for "display-level" tasks: root tasks OR children of epics.
 * Excludes subtasks of regular tasks (those are loaded on demand).
 */
export const ROOT_OR_EPIC_CHILD = { OR: [{ parentTaskId: null }, { parentTask: { taskType: 'epic' } }] };

export async function buildPromptLogContext(context: Context): Promise<PromptLogContext> {
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

/** Check budget before an AI call. Returns the status (for warnings). */
export async function enforceBudget(context: Context): Promise<BudgetStatus> {
  const user = requireOrg(context);
  return checkBudget(context.prisma, user.orgId);
}

export const helperMutations = {
  setAIBudget: async (
    _parent: unknown,
    args: { monthlyBudgetCentsUSD?: number | null; alertThreshold?: number | null; budgetEnforcement?: string | null; promptLoggingEnabled?: boolean | null },
    context: Context
  ) => {
    const user = requireOrg(context);
    if (user.role !== 'org:admin') {
      throw new AuthorizationError('Admin role required');
    }
    if (args.alertThreshold != null && (args.alertThreshold < 1 || args.alertThreshold > 100)) {
      throw new ValidationError('Alert threshold must be between 1 and 100');
    }
    if (args.budgetEnforcement != null && !['soft', 'hard'].includes(args.budgetEnforcement)) {
      throw new ValidationError('Budget enforcement must be "soft" or "hard"');
    }
    const oldOrg = await context.prisma.org.findUnique({
      where: { orgId: user.orgId },
      select: { monthlyBudgetCentsUSD: true },
    });
    const result = await context.prisma.org.update({
      where: { orgId: user.orgId },
      data: {
        ...(args.monthlyBudgetCentsUSD !== undefined && { monthlyBudgetCentsUSD: args.monthlyBudgetCentsUSD ?? null }),
        ...(args.alertThreshold != null && { budgetAlertThreshold: args.alertThreshold }),
        ...(args.budgetEnforcement != null && { budgetEnforcement: args.budgetEnforcement }),
        ...(args.promptLoggingEnabled != null && { promptLoggingEnabled: args.promptLoggingEnabled }),
      },
    });
    auditLog(context.prisma, {
      orgId: user.orgId,
      userId: user.userId,
      action: 'ai_budget_changed',
      field: 'monthlyBudgetCentsUSD',
      oldValue: String(oldOrg?.monthlyBudgetCentsUSD ?? ''),
      newValue: String(args.monthlyBudgetCentsUSD ?? ''),
    });
    return result;
  },
};
