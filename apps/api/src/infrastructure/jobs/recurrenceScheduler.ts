import type { PrismaClient } from '@prisma/client';

/**
 * Re-uses the processRecurrence logic from the recurrence scheduler utility.
 * We import the module and call its internal function.
 */
export function createHandler(prisma: PrismaClient) {
  return async () => {
    // Import dynamically to call the internal processRecurrence function.
    // The recurrenceScheduler module exports start/stop but the core logic
    // is processRecurrence. We use the same cron+task-creation approach.
    const { cronMatchesNow } = await import('../../utils/recurrenceScheduler.js');
    const now = new Date();
    const DEBOUNCE_HOURS = 23;

    const templates = await prisma.task.findMany({
      where: { recurrenceRule: { not: null }, archived: false },
      select: {
        taskId: true, title: true, description: true, instructions: true,
        priority: true, projectId: true, orgId: true, sprintId: true,
        recurrenceRule: true, recurrenceLastCreated: true,
      },
    });

    for (const template of templates) {
      if (!template.recurrenceRule) continue;
      if (!cronMatchesNow(template.recurrenceRule, now)) continue;

      if (template.recurrenceLastCreated) {
        const hoursSince = (now.getTime() - template.recurrenceLastCreated.getTime()) / (1000 * 60 * 60);
        if (hoursSince < DEBOUNCE_HOURS) continue;
      }

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
    }
  };
}
