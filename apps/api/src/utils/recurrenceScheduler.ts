import type { PrismaClient } from '@prisma/client';
import { createChildLogger } from './logger.js';

const log = createChildLogger('recurrence');

/**
 * Parse a 5-field cron expression and check if it matches the current time.
 * Fields: minute hour dayOfMonth month dayOfWeek
 * Supports: exact numbers, *, and step syntax (e.g. * /5)
 */
export function cronMatchesNow(cronExpr: string, now: Date): boolean {
  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length !== 5) return false;

  const values = [
    now.getMinutes(),
    now.getHours(),
    now.getDate(),
    now.getMonth() + 1,
    now.getDay(),
  ];

  for (let i = 0; i < 5; i++) {
    if (!fieldMatches(parts[i], values[i])) return false;
  }
  return true;
}

export function fieldMatches(field: string, value: number): boolean {
  // Handle comma-separated values
  if (field.includes(',')) {
    return field.split(',').some(part => fieldMatches(part.trim(), value));
  }

  // Wildcard
  if (field === '*') return true;

  // Step syntax: */N
  const stepMatch = field.match(/^\*\/(\d+)$/);
  if (stepMatch) {
    const step = parseInt(stepMatch[1], 10);
    return step > 0 && value % step === 0;
  }

  // Range: N-M
  const rangeMatch = field.match(/^(\d+)-(\d+)$/);
  if (rangeMatch) {
    const low = parseInt(rangeMatch[1], 10);
    const high = parseInt(rangeMatch[2], 10);
    return value >= low && value <= high;
  }

  // Exact number
  const exact = parseInt(field, 10);
  if (!isNaN(exact)) return value === exact;

  return false;
}

const DEBOUNCE_HOURS = 23;

async function processRecurrence(prisma: PrismaClient): Promise<void> {
  const now = new Date();
  const templates = await prisma.task.findMany({
    where: { recurrenceRule: { not: null }, archived: false },
    select: {
      taskId: true,
      title: true,
      description: true,
      instructions: true,
      priority: true,
      projectId: true,
      orgId: true,
      sprintId: true,
      recurrenceRule: true,
      recurrenceLastCreated: true,
    },
  });

  for (const template of templates) {
    if (!template.recurrenceRule) continue;
    if (!cronMatchesNow(template.recurrenceRule, now)) continue;

    // Debounce: skip if last created less than 23 hours ago
    if (template.recurrenceLastCreated) {
      const hoursSince = (now.getTime() - template.recurrenceLastCreated.getTime()) / (1000 * 60 * 60);
      if (hoursSince < DEBOUNCE_HOURS) continue;
    }

    try {
      await prisma.task.create({
        data: {
          title: template.title,
          description: template.description,
          instructions: template.instructions,
          priority: template.priority,
          projectId: template.projectId,
          orgId: template.orgId,
          sprintId: template.sprintId,
          recurrenceParentId: template.taskId,
        },
      });
      await prisma.task.update({
        where: { taskId: template.taskId },
        data: { recurrenceLastCreated: now },
      });
      log.info({ taskId: template.taskId, title: template.title }, 'Created recurring task instance');
    } catch (err) {
      log.error({ err, taskId: template.taskId }, 'Failed to create recurring task instance');
    }
  }
}

let schedulerTimer: NodeJS.Timeout | null = null;

export function startRecurrenceScheduler(prisma: PrismaClient): NodeJS.Timeout {
  const timer = setInterval(async () => {
    const { tryAdvisoryLock, releaseAdvisoryLock, LOCK_IDS } = await import('./advisoryLock.js');
    let acquired = false;
    try {
      acquired = await tryAdvisoryLock(prisma, LOCK_IDS.RECURRENCE_SCHEDULER);
      if (!acquired) return; // another replica is handling it
      await processRecurrence(prisma);
    } catch (err) {
      log.error({ err }, 'Recurrence processing failed');
    } finally {
      if (acquired) await releaseAdvisoryLock(prisma, LOCK_IDS.RECURRENCE_SCHEDULER);
    }
  }, 60_000);
  schedulerTimer = timer;
  log.info('Recurrence scheduler started (60s interval)');
  return timer;
}

export function stopRecurrenceScheduler(timer?: NodeJS.Timeout): void {
  const t = timer ?? schedulerTimer;
  if (t) {
    clearInterval(t);
    schedulerTimer = null;
    log.info('Recurrence scheduler stopped');
  }
}
