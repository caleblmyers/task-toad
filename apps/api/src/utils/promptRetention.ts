import type { PrismaClient } from '@prisma/client';
import { createChildLogger } from './logger.js';

const log = createChildLogger('prompt-retention');

/**
 * Delete expired AI prompt logs. Runs periodically to enforce the retention policy.
 * Deletes in batches to avoid long transactions.
 */
export async function cleanExpiredPromptLogs(prisma: PrismaClient): Promise<void> {
  try {
    const result = await prisma.aIPromptLog.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });
    if (result.count > 0) {
      log.info({ deleted: result.count }, 'Cleaned expired AI prompt logs');
    }
  } catch (err) {
    log.error({ err }, 'Failed to clean expired AI prompt logs');
  }
}
