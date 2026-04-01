/**
 * Domain event types and typed payload map for the event bus.
 */

export interface BaseEventPayload {
  orgId: string;
  userId: string;
  projectId: string;
  timestamp: string;
}

export interface TaskPayload {
  taskId: string;
  title: string;
  status: string;
  projectId: string;
  orgId: string;
  taskType: string;
  [key: string]: unknown;
}

export interface SprintPayload {
  sprintId: string;
  name: string;
  projectId: string;
  orgId: string;
  [key: string]: unknown;
}

export interface CommentPayload {
  commentId: string;
  taskId: string;
  content: string;
  [key: string]: unknown;
}

export interface FieldChange {
  old: string | null;
  new: string | null;
}

export interface DomainEventMap {
  'task.created': BaseEventPayload & {
    task: TaskPayload;
  };
  'task.updated': BaseEventPayload & {
    task: TaskPayload;
    changes: Record<string, FieldChange>;
    previousAssigneeId?: string | null;
  };
  'task.deleted': BaseEventPayload & {
    taskId: string;
  };
  'task.bulk_updated': BaseEventPayload & {
    taskIds: string[];
    changes?: Record<string, FieldChange>;
  };
  'task.assignee_added': BaseEventPayload & {
    taskId: string;
    taskTitle: string;
    assigneeId: string;
  };
  'task.assignee_removed': BaseEventPayload & {
    taskId: string;
    assigneeId: string;
  };
  'task.watcher_added': BaseEventPayload & {
    taskId: string;
    taskTitle: string;
    watcherId: string;
  };
  'task.watcher_removed': BaseEventPayload & {
    taskId: string;
    taskTitle: string;
    watcherId: string;
  };
  'task.reordered': BaseEventPayload & {
    task: TaskPayload;
  };
  'subtask.created': BaseEventPayload & {
    task: TaskPayload;
    parentTaskId: string;
  };
  'comment.created': BaseEventPayload & {
    comment: CommentPayload;
    task: TaskPayload;
    mentionedUserIds: string[];
  };
  'sprint.created': BaseEventPayload & {
    sprint: SprintPayload;
  };
  'sprint.updated': BaseEventPayload & {
    sprint: SprintPayload;
  };
  'sprint.deleted': BaseEventPayload & {
    sprintId: string;
    sprintName: string;
  };
  'sprint.closed': BaseEventPayload & {
    sprint: SprintPayload;
  };
  'project.updated': BaseEventPayload & {
    changes: Record<string, FieldChange>;
  };
  'project.archived': BaseEventPayload & {
    archived: boolean;
  };
  'task.action_started': BaseEventPayload & {
    actionId: string;
    actionType: string;
    actionLabel: string;
    planId: string;
    taskId: string;
  };
  'task.action_completed': BaseEventPayload & {
    actionId: string;
    actionType: string;
    planId: string;
    taskId: string;
    success: boolean;
  };
  'task.action_plan_completed': BaseEventPayload & {
    planId: string;
    taskId: string;
    taskTitle: string;
  };
  'task.action_plan_failed': BaseEventPayload & {
    planId: string;
    taskId: string;
    taskTitle: string;
    lastFailedActionId: string;
    lastFailedActionType: string;
    errorMessage: string;
  };
  'task.action_plan_replanned': BaseEventPayload & {
    planId: string;
    newPlanId: string;
    taskId: string;
    taskTitle: string;
    attempt: number;
  };
  'task.blocked': BaseEventPayload & {
    taskId: string;
    taskTitle: string;
    blockerTaskId: string;
    blockerTaskTitle: string;
    reason: 'dependency_failed';
  };
  'task.unblocked': BaseEventPayload & {
    taskId: string;
    taskTitle: string;
    unblockerTaskId: string;
  };
  'session.started': BaseEventPayload & { sessionId: string };
  'session.completed': BaseEventPayload & { sessionId: string };
  'session.failed': BaseEventPayload & { sessionId: string; reason: string };
  'session.paused': BaseEventPayload & { sessionId: string };
  'ai.progress': BaseEventPayload & {
    operation: string;
    step: string;
  };
  'health.alert': BaseEventPayload & {
    taskId: string;
    taskTitle: string;
    planId: string;
    status: 'executing' | 'approved';
    minutesStuck: number;
  };
}

export type EventName = keyof DomainEventMap;
export type DomainEvent<E extends EventName> = DomainEventMap[E];
