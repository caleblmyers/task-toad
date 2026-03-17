import type { PrismaClient } from '@prisma/client';
import type { EventBus } from '../eventbus/port.js';
import { dispatchSlackNotifications } from '../../utils/notificationUtils.js';

export function register(bus: EventBus, prisma: PrismaClient): void {
  bus.on('task.created', (e) => {
    dispatchSlackNotifications(prisma, e.orgId, 'task.created', { task: e.task });
  });

  bus.on('task.updated', (e) => {
    if (Object.keys(e.changes).length > 0) {
      dispatchSlackNotifications(prisma, e.orgId, 'task.updated', { task: e.task, changes: e.changes });
    }
  });

  bus.on('sprint.created', (e) => {
    dispatchSlackNotifications(prisma, e.orgId, 'sprint.created', { sprint: e.sprint });
  });

  bus.on('sprint.closed', (e) => {
    dispatchSlackNotifications(prisma, e.orgId, 'sprint.closed', { sprint: e.sprint });
  });
}
