import type { PrismaClient } from '@prisma/client';
import type { EventBus } from '../eventbus/port.js';
import { executeAutomations } from '../../utils/automationEngine.js';

export function register(bus: EventBus, prisma: PrismaClient): void {
  bus.on('task.updated', (e) => {
    if (e.changes.status) {
      // Include full task fields so compound conditions can match on status, priority, taskType, assigneeId, etc.
      const { taskId: _id, ...taskFields } = e.task;
      executeAutomations(prisma, {
        type: 'task.status_changed',
        projectId: e.projectId,
        orgId: e.orgId,
        taskId: e.task.taskId,
        userId: e.userId,
        data: { ...taskFields, oldStatus: e.changes.status.old, newStatus: e.changes.status.new },
      });
    }
  });
}
