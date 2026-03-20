import type { EventBus } from '../eventbus/port.js';
import { sseManager } from '../../utils/sseManager.js';

export function register(bus: EventBus): void {
  bus.on('task.created', (e) => {
    sseManager.broadcast(e.orgId, 'task.created', { task: e.task });
  });

  bus.on('task.updated', (e) => {
    if (Object.keys(e.changes).length > 0) {
      sseManager.broadcast(e.orgId, 'task.updated', { task: e.task });
    }
  });

  bus.on('task.bulk_updated', (e) => {
    sseManager.broadcast(e.orgId, 'tasks.bulk_updated', { taskIds: e.taskIds });
  });

  bus.on('task.reordered', (e) => {
    sseManager.broadcast(e.orgId, 'task.updated', { task: e.task });
  });

  bus.on('comment.created', (e) => {
    sseManager.broadcast(e.orgId, 'comment.created', {
      comment: { commentId: e.comment.commentId, taskId: e.comment.taskId },
    });
  });

  bus.on('sprint.created', (e) => {
    sseManager.broadcast(e.orgId, 'sprint.created', { sprint: e.sprint });
  });

  bus.on('sprint.updated', (e) => {
    sseManager.broadcast(e.orgId, 'sprint.updated', { sprint: e.sprint });
  });

  bus.on('sprint.closed', (e) => {
    sseManager.broadcast(e.orgId, 'sprint.closed', { sprint: e.sprint });
  });

  bus.on('task.action_completed', (e) => {
    sseManager.broadcast(e.orgId, 'task.action_completed', {
      actionId: e.actionId,
      actionType: e.actionType,
      planId: e.planId,
      taskId: e.taskId,
      success: e.success,
    });
  });

  bus.on('task.action_plan_completed', (e) => {
    sseManager.broadcast(e.orgId, 'task.action_plan_completed', {
      planId: e.planId,
      taskId: e.taskId,
    });
  });

  bus.on('task.action_plan_failed', (e) => {
    sseManager.broadcast(e.orgId, 'task.action_plan_failed', {
      planId: e.planId,
      taskId: e.taskId,
      taskTitle: e.taskTitle,
      errorMessage: e.errorMessage,
    });
  });

  bus.on('task.blocked', (e) => {
    sseManager.broadcast(e.orgId, 'task.blocked', {
      taskId: e.taskId,
      taskTitle: e.taskTitle,
      blockerTaskId: e.blockerTaskId,
      reason: e.reason,
    });
  });

  bus.on('task.unblocked', (e) => {
    sseManager.broadcast(e.orgId, 'task.unblocked', {
      taskId: e.taskId,
      taskTitle: e.taskTitle,
    });
  });
}
