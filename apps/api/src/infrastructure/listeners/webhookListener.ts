import type { PrismaClient } from '@prisma/client';
import type { EventBus } from '../eventbus/port.js';
import { dispatchWebhooks } from '../../utils/webhookDispatcher.js';

export function register(bus: EventBus, prisma: PrismaClient): void {
  bus.on('task.created', (e) => {
    dispatchWebhooks(prisma, e.orgId, 'task.created', { task: e.task });
  });

  bus.on('task.updated', (e) => {
    if (Object.keys(e.changes).length > 0) {
      dispatchWebhooks(prisma, e.orgId, 'task.updated', { task: e.task, changes: e.changes });
    }
  });

  bus.on('task.deleted', (e) => {
    dispatchWebhooks(prisma, e.orgId, 'task.deleted', { taskId: e.taskId });
  });

  bus.on('comment.created', (e) => {
    dispatchWebhooks(prisma, e.orgId, 'comment.created', {
      comment: { commentId: e.comment.commentId, taskId: e.comment.taskId, content: e.comment.content },
      task: { taskId: e.task.taskId, title: e.task.title, projectId: e.task.projectId },
    });
  });

  bus.on('sprint.created', (e) => {
    dispatchWebhooks(prisma, e.orgId, 'sprint.created', { sprint: e.sprint });
  });

  bus.on('sprint.closed', (e) => {
    dispatchWebhooks(prisma, e.orgId, 'sprint.closed', { sprint: e.sprint });
  });
}
