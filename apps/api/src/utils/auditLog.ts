import type { PrismaClient } from '@prisma/client';
import { logger } from './logger.js';

export function auditLog(
  prisma: PrismaClient,
  opts: {
    orgId: string;
    userId: string;
    action: string;
    field?: string;
    oldValue?: string;
    newValue?: string;
  },
): void {
  prisma.activity
    .create({ data: opts })
    .catch((err: unknown) => {
      logger.error({ err, ...opts }, 'Failed to write audit log');
    });
}
