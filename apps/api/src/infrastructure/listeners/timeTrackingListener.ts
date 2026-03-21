import type { PrismaClient } from '@prisma/client';
import type { EventBus } from '../eventbus/port.js';
import { logger } from '../../utils/logger.js';

/**
 * Automatically creates TimeEntry records when a task transitions
 * away from `in_progress`. Duration is calculated from the most recent
 * activity that set the status to `in_progress`.
 */
export function register(bus: EventBus, prisma: PrismaClient): void {
  bus.on('task.updated', async (e) => {
    const statusChange = e.changes['status'];
    if (!statusChange) return;

    const oldStatus = statusChange.old;
    const newStatus = statusChange.new;

    // Only create an entry when transitioning AWAY from in_progress
    if (oldStatus !== 'in_progress' || newStatus === 'in_progress') return;

    try {
      // Find the most recent activity where status was set TO in_progress
      const startActivity = await prisma.activity.findFirst({
        where: {
          taskId: e.task.taskId,
          action: 'task.updated',
          field: 'status',
          newValue: 'in_progress',
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!startActivity) {
        logger.warn(
          { taskId: e.task.taskId },
          'Auto-track: no in_progress activity found, skipping',
        );
        return;
      }

      const startTime = startActivity.createdAt;
      const endTime = new Date();
      const durationMs = endTime.getTime() - startTime.getTime();
      const durationMinutes = Math.max(1, Math.round(durationMs / 60000));

      const today = endTime.toISOString().slice(0, 10);

      // Use the task's assignee or the user who changed the status
      const userId = e.task.assigneeId as string || e.userId;

      await prisma.timeEntry.create({
        data: {
          orgId: e.orgId,
          taskId: e.task.taskId,
          userId,
          durationMinutes,
          loggedDate: today,
          description: `Auto-tracked: ${oldStatus} → ${newStatus}`,
          autoTracked: true,
        },
      });

      logger.info(
        { taskId: e.task.taskId, durationMinutes },
        'Auto-tracked time entry created',
      );
    } catch (err) {
      logger.error(
        { taskId: e.task.taskId, err },
        'Failed to auto-track time entry',
      );
    }
  });
}
