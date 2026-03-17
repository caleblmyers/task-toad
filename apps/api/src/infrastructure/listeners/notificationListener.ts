import type { PrismaClient } from '@prisma/client';
import type { EventBus } from '../eventbus/port.js';
import { createNotification } from '../../utils/notification.js';

export function register(bus: EventBus, prisma: PrismaClient): void {
  bus.on('task.updated', async (e) => {
    const changes = e.changes;

    // Notify on assignment change
    if (changes.assigneeId && changes.assigneeId.new && changes.assigneeId.new !== e.userId) {
      createNotification(prisma, {
        orgId: e.orgId,
        userId: changes.assigneeId.new,
        type: 'assigned',
        title: `You were assigned to "${e.task.title}"`,
        linkUrl: `/app/projects/${e.projectId}`,
        relatedTaskId: e.task.taskId,
        relatedProjectId: e.projectId,
      });
    }

    // Notify on status change
    if (changes.status && e.previousAssigneeId && e.previousAssigneeId !== e.userId) {
      const user = await prisma.user.findUnique({
        where: { userId: e.userId },
        select: { email: true },
      });
      createNotification(prisma, {
        orgId: e.orgId,
        userId: e.previousAssigneeId,
        type: 'status_changed',
        title: `${user?.email ?? 'Someone'} changed "${e.task.title}" status to ${changes.status.new}`,
        linkUrl: `/app/projects/${e.projectId}`,
        relatedTaskId: e.task.taskId,
        relatedProjectId: e.projectId,
      });
    }
  });

  bus.on('task.assignee_added', (e) => {
    if (e.assigneeId !== e.userId) {
      createNotification(prisma, {
        orgId: e.orgId,
        userId: e.assigneeId,
        type: 'assigned',
        title: `You were assigned to "${e.taskTitle}"`,
        linkUrl: `/app/projects/${e.projectId}`,
        relatedTaskId: e.taskId,
        relatedProjectId: e.projectId,
      });
    }
  });

  bus.on('comment.created', (e) => {
    // Notify task assignee
    if (e.task.assigneeId && (e.task.assigneeId as string) !== e.userId) {
      const contentPreview = e.comment.content.length > 100
        ? e.comment.content.slice(0, 100) + '\u2026'
        : e.comment.content;
      createNotification(prisma, {
        orgId: e.orgId,
        userId: e.task.assigneeId as string,
        type: 'commented',
        title: `New comment on "${e.task.title}"`,
        body: contentPreview,
        linkUrl: `/app/projects/${e.projectId}`,
        relatedTaskId: e.task.taskId,
        relatedProjectId: e.projectId,
      });
    }

    // Notify mentioned users
    for (const mentionedUserId of e.mentionedUserIds) {
      if (mentionedUserId !== e.userId) {
        const contentPreview = e.comment.content.length > 100
          ? e.comment.content.slice(0, 100) + '\u2026'
          : e.comment.content;
        createNotification(prisma, {
          orgId: e.orgId,
          userId: mentionedUserId,
          type: 'mentioned',
          title: `You were mentioned in a comment on "${e.task.title}"`,
          body: contentPreview,
          linkUrl: `/app/projects/${e.projectId}`,
          relatedTaskId: e.task.taskId,
          relatedProjectId: e.projectId,
        });
      }
    }
  });
}
