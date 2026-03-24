import type { PrismaClient } from '@prisma/client';

const TTL_MS = 5 * 60_000; // 5 minutes

interface CacheEntry {
  plan: string;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

export async function getCachedOrgPlan(
  prisma: PrismaClient,
  orgId: string,
): Promise<string | undefined> {
  const cached = cache.get(orgId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.plan;
  }

  const org = await prisma.org.findUnique({
    where: { orgId },
    select: { plan: true },
  });

  if (org) {
    cache.set(orgId, { plan: org.plan, expiresAt: Date.now() + TTL_MS });
    return org.plan;
  }

  cache.delete(orgId);
  return undefined;
}

export function invalidateOrgPlanCache(orgId: string): void {
  cache.delete(orgId);
}
