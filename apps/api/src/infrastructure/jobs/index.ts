import type { PrismaClient } from '@prisma/client';
import type { JobQueue } from '../jobqueue/port.js';
import { LOCK_IDS } from '../../utils/advisoryLock.js';
import { createHandler as createDueDateHandler } from './dueDateReminder.js';
import { createHandler as createPromptCleanupHandler } from './promptCleanup.js';
import { createHandler as createWebhookRetryHandler } from './webhookRetry.js';
import { createHandler as createRecurrenceHandler } from './recurrenceScheduler.js';
import { createHandler as createPrismaMetricsHandler } from './prismaMetrics.js';
import { createHandler as createActionExecutorHandler } from './actionExecutor.js';

export function registerJobs(queue: JobQueue, prisma: PrismaClient): void {
  // Register handlers
  queue.registerHandler('due-date-reminders', createDueDateHandler(prisma), {
    advisoryLockId: LOCK_IDS.DUE_DATE_REMINDERS,
  });

  queue.registerHandler('prompt-cleanup', createPromptCleanupHandler(prisma), {
    advisoryLockId: LOCK_IDS.PROMPT_CLEANUP,
  });

  queue.registerHandler('webhook-retry', createWebhookRetryHandler(prisma), {
    advisoryLockId: LOCK_IDS.WEBHOOK_RETRY,
  });

  queue.registerHandler('recurrence-scheduler', createRecurrenceHandler(prisma), {
    advisoryLockId: LOCK_IDS.RECURRENCE_SCHEDULER,
  });

  queue.registerHandler('prisma-metrics', createPrismaMetricsHandler(prisma));

  queue.registerHandler('action-execute', createActionExecutorHandler(prisma), {
    maxRetries: 2,
    retryDelays: [5000, 15000],
  });

  // Schedule recurring jobs
  queue.schedule('due-date-reminders', 15 * 60 * 1000, 'due-date-reminders');
  queue.schedule('prompt-cleanup', 6 * 60 * 60 * 1000, 'prompt-cleanup');
  queue.schedule('webhook-retry', 30_000, 'webhook-retry');
  queue.schedule('recurrence-scheduler', 60_000, 'recurrence-scheduler');
  queue.schedule('prisma-metrics', 30_000, 'prisma-metrics');

  // Run prompt cleanup once at startup
  queue.enqueue('prompt-cleanup', {} as Record<string, never>);
}
