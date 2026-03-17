import type { PrismaClient } from '@prisma/client';
import { checkDueDateReminders } from '../../utils/dueDateReminder.js';

export function createHandler(prisma: PrismaClient) {
  return async () => {
    await checkDueDateReminders(prisma);
  };
}
