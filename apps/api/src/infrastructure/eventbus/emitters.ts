import { getEventBus } from './index.js';
import type { DomainEventMap } from './types.js';

interface EmitContext {
  orgId: string;
  userId: string;
}

type TaskEventName = Extract<keyof DomainEventMap,
  | 'task.created' | 'task.updated' | 'task.bulk_updated' | 'subtask.created'
  | 'task.reordered' | 'task.assignee_added' | 'task.assignee_removed'
  | 'task.watcher_added' | 'task.watcher_removed'>;

type SprintEventName = Extract<keyof DomainEventMap,
  'sprint.created' | 'sprint.updated' | 'sprint.deleted' | 'sprint.closed'>;

type ProjectEventName = Extract<keyof DomainEventMap,
  'project.updated' | 'project.archived'>;

type CommentEventName = Extract<keyof DomainEventMap, 'comment.created'>;

export function emitTaskEvent<E extends TaskEventName>(
  event: E,
  ctx: EmitContext,
  payload: Omit<DomainEventMap[E], 'orgId' | 'userId' | 'timestamp'>,
) {
  getEventBus().emit(event, { ...ctx, timestamp: new Date().toISOString(), ...payload } as DomainEventMap[E]);
}

export function emitSprintEvent<E extends SprintEventName>(
  event: E,
  ctx: EmitContext,
  payload: Omit<DomainEventMap[E], 'orgId' | 'userId' | 'timestamp'>,
) {
  getEventBus().emit(event, { ...ctx, timestamp: new Date().toISOString(), ...payload } as DomainEventMap[E]);
}

export function emitProjectEvent<E extends ProjectEventName>(
  event: E,
  ctx: EmitContext,
  payload: Omit<DomainEventMap[E], 'orgId' | 'userId' | 'timestamp'>,
) {
  getEventBus().emit(event, { ...ctx, timestamp: new Date().toISOString(), ...payload } as DomainEventMap[E]);
}

export function emitCommentEvent<E extends CommentEventName>(
  event: E,
  ctx: EmitContext,
  payload: Omit<DomainEventMap[E], 'orgId' | 'userId' | 'timestamp'>,
) {
  getEventBus().emit(event, { ...ctx, timestamp: new Date().toISOString(), ...payload } as DomainEventMap[E]);
}
