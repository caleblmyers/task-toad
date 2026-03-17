import type { PrismaClient } from '@prisma/client';
import type { AIFeature } from './aiTypes.js';
import { AI_MODEL, COST_PER_INPUT_TOKEN, COST_PER_OUTPUT_TOKEN } from './aiConfig.js';
import { createChildLogger } from '../utils/logger.js';
import { createNotification } from '../utils/notification.js';

const log = createChildLogger('ai-budget');

export interface BudgetStatus {
  allowed: boolean;
  warning: boolean;
  message: string | null;
  usedPercent: number | null;
}

/**
 * Log an AI usage event to the database.
 */
export async function logUsageToDB(
  prisma: PrismaClient,
  params: {
    orgId: string;
    userId: string;
    feature: AIFeature;
    inputTokens: number;
    outputTokens: number;
    latencyMs: number;
    cached?: boolean;
  }
): Promise<void> {
  const costUSD =
    params.inputTokens * COST_PER_INPUT_TOKEN +
    params.outputTokens * COST_PER_OUTPUT_TOKEN;

  await prisma.aIUsageLog.create({
    data: {
      orgId: params.orgId,
      userId: params.userId,
      feature: params.feature,
      model: AI_MODEL,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      costUSD,
      latencyMs: params.latencyMs,
      cached: params.cached ?? false,
    },
  });
}

/**
 * Check whether the org has exceeded its monthly AI budget.
 *
 * - If no budget is set, returns allowed with no warning.
 * - In `hard` mode: throws an error when budget is exceeded.
 * - In `soft` mode (default): returns a warning but allows the call to proceed.
 * - Sends a notification when the alert threshold is crossed (once per month).
 */
export async function checkBudget(
  prisma: PrismaClient,
  orgId: string
): Promise<BudgetStatus> {
  const org = await prisma.org.findUnique({
    where: { orgId },
    select: {
      monthlyBudgetCentsUSD: true,
      budgetAlertThreshold: true,
      budgetEnforcement: true,
    },
  });

  if (!org?.monthlyBudgetCentsUSD) {
    return { allowed: true, warning: false, message: null, usedPercent: null };
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const result = await prisma.aIUsageLog.aggregate({
    where: {
      orgId,
      createdAt: { gte: startOfMonth },
    },
    _sum: { costUSD: true },
  });

  const totalCostCents = Math.round((result._sum.costUSD ?? 0) * 100);
  const usedPercent = Math.round((totalCostCents / org.monthlyBudgetCentsUSD) * 10000) / 100;
  const budgetUSD = (org.monthlyBudgetCentsUSD / 100).toFixed(2);
  const isHard = org.budgetEnforcement === 'hard';

  // Check if alert threshold crossed — notify admins once per month
  if (usedPercent >= org.budgetAlertThreshold) {
    sendBudgetAlertIfNeeded(prisma, orgId, usedPercent, org.budgetAlertThreshold);
  }

  if (totalCostCents >= org.monthlyBudgetCentsUSD) {
    const message = `AI budget exceeded ($${budgetUSD}/mo). ${isHard ? 'Increase your budget in Settings to continue.' : 'Usage will continue but you are over budget.'}`;

    if (isHard) {
      throw new Error(message);
    }

    log.warn({ orgId, usedPercent, enforcement: 'soft' }, 'AI budget exceeded (soft mode — allowing)');
    return { allowed: true, warning: true, message, usedPercent };
  }

  if (usedPercent >= org.budgetAlertThreshold) {
    const message = `AI usage at ${usedPercent.toFixed(1)}% of $${budgetUSD} monthly budget.`;
    return { allowed: true, warning: true, message, usedPercent };
  }

  return { allowed: true, warning: false, message: null, usedPercent };
}

/**
 * Send a budget alert notification to org admins, but only once per billing period.
 */
function sendBudgetAlertIfNeeded(
  prisma: PrismaClient,
  orgId: string,
  usedPercent: number,
  _threshold: number
): void {
  // Fire-and-forget
  doSendBudgetAlert(prisma, orgId, usedPercent).catch((err: unknown) => {
    log.error({ err, orgId }, 'Failed to send budget alert notification');
  });
}

async function doSendBudgetAlert(
  prisma: PrismaClient,
  orgId: string,
  usedPercent: number
): Promise<void> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Check if we already sent a budget alert this month
  const existing = await prisma.notification.findFirst({
    where: {
      orgId,
      type: 'budget_alert',
      createdAt: { gte: startOfMonth },
    },
  });

  if (existing) return; // Already notified this month

  // Get all org admins
  const admins = await prisma.user.findMany({
    where: { orgId, role: 'org:admin' },
    select: { userId: true },
  });

  for (const admin of admins) {
    createNotification(prisma, {
      orgId,
      userId: admin.userId,
      type: 'budget_alert',
      title: `AI budget at ${usedPercent.toFixed(0)}%`,
      body: `Your organization's AI usage has reached ${usedPercent.toFixed(1)}% of the monthly budget. Review usage in Settings.`,
      linkUrl: '/settings',
    });
  }
}
