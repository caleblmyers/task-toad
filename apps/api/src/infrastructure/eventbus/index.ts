export type { EventBus } from './port.js';
export type { EventName, DomainEvent, DomainEventMap, BaseEventPayload, TaskPayload, SprintPayload, CommentPayload, FieldChange } from './types.js';
export { InProcessEventBus } from './inProcessAdapter.js';

import type { EventBus } from './port.js';

let instance: EventBus | null = null;

export function getEventBus(): EventBus {
  if (!instance) {
    throw new Error('EventBus not initialized — call setEventBus() first');
  }
  return instance;
}

export function setEventBus(bus: EventBus): void {
  instance = bus;
}
