import type { PrismaClient } from '@prisma/client';
import type { AIFeature } from './aiTypes.js';
import { AI_MODEL, COST_PER_INPUT_TOKEN, COST_PER_OUTPUT_TOKEN } from './aiConfig.js';

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
 * Returns true if usage is within budget (or no budget is set).
 * Throws an error if the budget is exceeded.
 */
export async function checkBudget(
  prisma: PrismaClient,
  orgId: string
): Promise<void> {
  const org = await prisma.org.findUnique({
    where: { orgId },
    select: { monthlyBudgetCentsUSD: true },
  });

  if (!org?.monthlyBudgetCentsUSD) return; // no budget set

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
  if (totalCostCents >= org.monthlyBudgetCentsUSD) {
    throw new Error('AI budget exceeded for this billing period. Increase your budget in Settings to continue.');
  }
}
