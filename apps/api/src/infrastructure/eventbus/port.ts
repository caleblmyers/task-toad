import type { EventName, DomainEvent } from './types.js';

/**
 * Port interface for the event bus.
 * Implementations can use in-process EventEmitter, Redis pub/sub, etc.
 */
export interface EventBus {
  /** Fire-and-forget — never throws to the caller. */
  emit<E extends EventName>(event: E, payload: DomainEvent<E>): void;

  /** Register a handler for a specific event. */
  on<E extends EventName>(event: E, handler: (payload: DomainEvent<E>) => void | Promise<void>): void;

  /** Register a handler that receives all events. */
  onAny(handler: (event: EventName, payload: DomainEvent<EventName>) => void | Promise<void>): void;

  /** Remove all listeners (used in shutdown/tests). */
  removeAllListeners(): void;
}
