import type { PrismaClient } from '@prisma/client';
import { createChildLogger } from './logger.js';

const log = createChildLogger('advisory-lock');

/**
 * Well-known advisory lock IDs for background jobs.
 * Using distinct ints so only one replica runs each processor.
 */
export const LOCK_IDS = {
  DUE_DATE_REMINDERS: 100001,
  WEBHOOK_RETRY: 100002,
  RECURRENCE_SCHEDULER: 100003,
  PROMPT_CLEANUP: 100004,
} as const;

/**
 * Try to acquire a PostgreSQL advisory lock (session-level, non-blocking).
 * Returns true if the lock was acquired, false if another process holds it.
 */
export async function tryAdvisoryLock(prisma: PrismaClient, lockId: number): Promise<boolean> {
  try {
    const result = await prisma.$queryRawUnsafe<Array<{ pg_try_advisory_lock: boolean }>>(
      `SELECT pg_try_advisory_lock(${lockId})`,
    );
    return result[0]?.pg_try_advisory_lock === true;
  } catch (err) {
    log.warn({ err, lockId }, 'Failed to acquire advisory lock');
    return false;
  }
}

/**
 * Release a PostgreSQL advisory lock.
 */
export async function releaseAdvisoryLock(prisma: PrismaClient, lockId: number): Promise<void> {
  try {
    await prisma.$queryRawUnsafe(`SELECT pg_advisory_unlock(${lockId})`);
  } catch (err) {
    log.warn({ err, lockId }, 'Failed to release advisory lock');
  }
}

/**
 * Wrap a background job function with advisory lock protection.
 * If the lock can't be acquired (another replica holds it), skip silently.
 */
export function withAdvisoryLock(
  prisma: PrismaClient,
  lockId: number,
  fn: (prisma: PrismaClient) => Promise<unknown>,
): () => Promise<void> {
  return async () => {
    const acquired = await tryAdvisoryLock(prisma, lockId);
    if (!acquired) return; // another replica is handling it
    try {
      await fn(prisma);
    } finally {
      await releaseAdvisoryLock(prisma, lockId);
    }
  };
}
