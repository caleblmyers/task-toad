import type { PrismaClient } from '@prisma/client';

export async function checkAIRateLimit(
  prisma: Pick<PrismaClient, 'aIPromptLog'>,
  orgId: string,
): Promise<void> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const count = await prisma.aIPromptLog.count({
    where: { orgId, createdAt: { gte: oneHourAgo } },
  });
  const limit = Number(process.env.AI_RATE_LIMIT_PER_HOUR) || 60;
  if (count >= limit) {
    throw new Error(
      `AI rate limit exceeded: ${count}/${limit} requests in the last hour. Please try again later.`,
    );
  }
}
