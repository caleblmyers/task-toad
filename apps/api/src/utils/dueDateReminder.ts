import type { PrismaClient } from '@prisma/client';
import { createNotification } from './notification.js';
import { createChildLogger } from './logger.js';

const log = createChildLogger('due-date-reminder');

export async function checkDueDateReminders(prisma: PrismaClient): Promise<number> {
  const now = new Date();
  const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const tasks = await prisma.task.findMany({
    where: {
      archived: false,
      assigneeId: { not: null },
      dueDate: { not: null, lte: oneDayFromNow.toISOString(), gt: now.toISOString() },
    },
    include: { project: true, assignee: true },
  });

  let sent = 0;
  for (const task of tasks) {
    // Dedup: skip if we already sent a reminder for this task in the last 12h
    const existing = await prisma.notification.findFirst({
      where: {
        relatedTaskId: task.taskId,
        type: 'due_date_reminder',
        createdAt: { gte: new Date(now.getTime() - 12 * 60 * 60 * 1000) },
      },
    });
    if (existing) continue;

    const dueDate = new Date(task.dueDate!);
    const hoursUntil = (dueDate.getTime() - now.getTime()) / (60 * 60 * 1000);
    const urgency = hoursUntil <= 1 ? 'due in less than 1 hour' : hoursUntil <= 24 ? 'due tomorrow' : 'due soon';

    createNotification(prisma, {
      orgId: task.orgId,
      userId: task.assigneeId!,
      type: 'due_date_reminder',
      title: `Task "${task.title}" is ${urgency}`,
      body: `Due: ${dueDate.toLocaleDateString()}`,
      linkUrl: `/app/projects/${task.projectId}?task=${task.taskId}`,
      relatedTaskId: task.taskId,
      relatedProjectId: task.projectId,
    });
    sent++;
  }

  if (sent > 0) {
    log.info({ count: sent }, 'Sent due date reminders');
  }
  return sent;
}
