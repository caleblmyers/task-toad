import type { PrismaClient } from '@prisma/client';
import { processRetryQueue } from '../../utils/webhookDispatcher.js';

export function createHandler(prisma: PrismaClient) {
  return async () => {
    await processRetryQueue(prisma);
  };
}
