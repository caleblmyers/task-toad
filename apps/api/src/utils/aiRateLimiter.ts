import type { PrismaClient } from '@prisma/client';

// ---------------------------------------------------------------------------
// In-memory sliding window cache — reduces DB queries to ~1 per hour per org
// ---------------------------------------------------------------------------

interface OrgWindow {
  count: number;
  windowStart: number;
}

const orgCounts = new Map<string, OrgWindow>();

const WINDOW_MS = 60 * 60 * 1000; // 1 hour

export async function checkAIRateLimit(
  prisma: Pick<PrismaClient, 'aIPromptLog'>,
  orgId: string,
): Promise<void> {
  const limit = Number(process.env.AI_RATE_LIMIT_PER_HOUR) || 60;
  const now = Date.now();

  const cached = orgCounts.get(orgId);
  if (cached && now - cached.windowStart < WINDOW_MS) {
    // Window still valid — use cached count
    if (cached.count >= limit) {
      throw new Error(
        `AI rate limit exceeded: ${cached.count}/${limit} requests in the last hour. Please try again later.`,
      );
    }
    cached.count++;
    return;
  }

  // Window expired or first check — refresh from DB
  const oneHourAgo = new Date(now - WINDOW_MS);
  const count = await prisma.aIPromptLog.count({
    where: { orgId, createdAt: { gte: oneHourAgo } },
  });

  if (count >= limit) {
    orgCounts.set(orgId, { count, windowStart: now });
    throw new Error(
      `AI rate limit exceeded: ${count}/${limit} requests in the last hour. Please try again later.`,
    );
  }

  orgCounts.set(orgId, { count: count + 1, windowStart: now });
}
