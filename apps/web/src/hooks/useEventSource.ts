import { useState, useEffect, useCallback, useRef } from 'react';
import { TOKEN_KEY } from '../api/client';

const SSE_EVENTS = [
  'task.created',
  'task.updated',
  'tasks.bulk_updated',
  'sprint.created',
  'sprint.updated',
  'sprint.closed',
] as const;

type SSEEventHandler = (event: string, data: unknown) => void;

export function useEventSource(onEvent: SSEEventHandler): { connected: boolean } {
  const [connected, setConnected] = useState(false);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const stableHandler = useCallback((eventName: string, data: unknown) => {
    onEventRef.current(eventName, data);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;

    const es = new EventSource(`/api/events?token=${encodeURIComponent(token)}`);

    es.addEventListener('connected', () => setConnected(true));

    for (const eventName of SSE_EVENTS) {
      es.addEventListener(eventName, (e) => {
        try {
          stableHandler(eventName, JSON.parse((e as MessageEvent).data));
        } catch {
          // ignore parse errors
        }
      });
    }

    es.onerror = () => {
      setConnected(false);
    };

    return () => {
      es.close();
      setConnected(false);
    };
  }, [stableHandler]);

  return { connected };
}
