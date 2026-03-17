import type { PrismaClient } from '@prisma/client';
import { cleanExpiredPromptLogs } from '../../utils/promptRetention.js';

export function createHandler(prisma: PrismaClient) {
  return async () => {
    await cleanExpiredPromptLogs(prisma);
  };
}
