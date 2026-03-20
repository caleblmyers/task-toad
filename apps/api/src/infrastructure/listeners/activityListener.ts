import type { PrismaClient } from '@prisma/client';
import type { EventBus } from '../eventbus/port.js';
import { logActivity } from '../../utils/activity.js';

export function register(bus: EventBus, prisma: PrismaClient): void {
  bus.on('task.created', (e) => {
    logActivity(prisma, {
      orgId: e.orgId, projectId: e.projectId, taskId: e.task.taskId, userId: e.userId,
      action: 'task.created',
    });
  });

  bus.on('task.updated', (e) => {
    for (const [field, change] of Object.entries(e.changes)) {
      logActivity(prisma, {
        orgId: e.orgId, projectId: e.projectId, taskId: e.task.taskId, userId: e.userId,
        action: 'task.updated', field, oldValue: change.old, newValue: change.new,
      });
    }
  });

  bus.on('task.bulk_updated', (e) => {
    for (const taskId of e.taskIds) {
      if (e.changes && Object.keys(e.changes).length > 0) {
        for (const [field, change] of Object.entries(e.changes)) {
          logActivity(prisma, {
            orgId: e.orgId, projectId: e.projectId, taskId, userId: e.userId,
            action: 'task.updated', field, oldValue: change.old, newValue: change.new,
          });
        }
      } else {
        logActivity(prisma, {
          orgId: e.orgId, projectId: e.projectId, taskId, userId: e.userId,
          action: 'task.bulk_updated',
        });
      }
    }
  });

  bus.on('task.assignee_added', (e) => {
    logActivity(prisma, {
      orgId: e.orgId, projectId: e.projectId, taskId: e.taskId, userId: e.userId,
      action: 'task.assignee_added', field: 'assignee', newValue: e.assigneeId,
    });
  });

  bus.on('task.assignee_removed', (e) => {
    logActivity(prisma, {
      orgId: e.orgId, projectId: e.projectId, taskId: e.taskId, userId: e.userId,
      action: 'task.assignee_removed', field: 'assignee', oldValue: e.assigneeId,
    });
  });

  bus.on('subtask.created', (e) => {
    logActivity(prisma, {
      orgId: e.orgId, projectId: e.projectId, taskId: e.task.taskId, userId: e.userId,
      action: 'task.created',
    });
  });

  bus.on('comment.created', (e) => {
    logActivity(prisma, {
      orgId: e.orgId, projectId: e.projectId, taskId: e.task.taskId, userId: e.userId,
      action: 'comment.created',
    });
  });

  bus.on('sprint.created', (e) => {
    logActivity(prisma, {
      orgId: e.orgId, projectId: e.projectId, sprintId: e.sprint.sprintId, userId: e.userId,
      action: 'sprint.created',
    });
  });

  bus.on('sprint.updated', (e) => {
    logActivity(prisma, {
      orgId: e.orgId, projectId: e.projectId, sprintId: e.sprint.sprintId, userId: e.userId,
      action: 'sprint.updated',
    });
  });

  bus.on('sprint.deleted', (e) => {
    logActivity(prisma, {
      orgId: e.orgId, projectId: e.projectId, sprintId: e.sprintId, userId: e.userId,
      action: 'sprint.deleted',
    });
  });

  bus.on('project.updated', (e) => {
    logActivity(prisma, {
      orgId: e.orgId, projectId: e.projectId, userId: e.userId,
      action: 'project.updated',
      ...(Object.keys(e.changes).length > 0 ? {
        field: Object.keys(e.changes)[0],
        oldValue: Object.values(e.changes)[0].old,
        newValue: Object.values(e.changes)[0].new,
      } : {}),
    });
  });

  bus.on('project.archived', (e) => {
    logActivity(prisma, {
      orgId: e.orgId, projectId: e.projectId, userId: e.userId,
      action: e.archived ? 'project.archived' : 'project.unarchived',
    });
  });
}
