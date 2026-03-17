import { EventEmitter } from 'node:events';
import type { EventBus } from './port.js';
import type { EventName, DomainEvent } from './types.js';
import { createChildLogger } from '../../utils/logger.js';

const log = createChildLogger('eventbus');

type AnyHandler = (event: EventName, payload: DomainEvent<EventName>) => void | Promise<void>;

export class InProcessEventBus implements EventBus {
  private emitter = new EventEmitter();
  private anyHandlers: AnyHandler[] = [];

  constructor() {
    // Allow many listeners (one per event type per listener module)
    this.emitter.setMaxListeners(100);
  }

  emit<E extends EventName>(event: E, payload: DomainEvent<E>): void {
    // Emit to specific handlers
    this.emitter.emit(event, payload);

    // Emit to wildcard handlers
    for (const handler of this.anyHandlers) {
      try {
        const result = handler(event, payload as DomainEvent<EventName>);
        if (result && typeof result.catch === 'function') {
          result.catch((err: unknown) => {
            log.error({ err, event }, 'onAny handler error');
          });
        }
      } catch (err) {
        log.error({ err, event }, 'onAny handler sync error');
      }
    }
  }

  on<E extends EventName>(event: E, handler: (payload: DomainEvent<E>) => void | Promise<void>): void {
    this.emitter.on(event, (payload: DomainEvent<E>) => {
      try {
        const result = handler(payload);
        if (result && typeof (result as Promise<void>).catch === 'function') {
          (result as Promise<void>).catch((err: unknown) => {
            log.error({ err, event }, 'Event handler error');
          });
        }
      } catch (err) {
        log.error({ err, event }, 'Event handler sync error');
      }
    });
  }

  onAny(handler: AnyHandler): void {
    this.anyHandlers.push(handler);
  }

  removeAllListeners(): void {
    this.emitter.removeAllListeners();
    this.anyHandlers = [];
  }
}
