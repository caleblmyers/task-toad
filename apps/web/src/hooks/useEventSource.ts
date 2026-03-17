import { useState, useEffect, useCallback, useRef } from 'react';
import { TOKEN_KEY } from '../api/client';

const SSE_EVENTS = [
  'task.created',
  'task.updated',
  'tasks.bulk_updated',
  'task.action_completed',
  'task.action_plan_completed',
  'sprint.created',
  'sprint.updated',
  'sprint.closed',
] as const;

type SSEEventHandler = (event: string, data: unknown) => void;

function parseSSE(text: string): Array<{ event: string; data: string }> {
  const messages: Array<{ event: string; data: string }> = [];
  let currentEvent = 'message';
  let currentData = '';

  for (const line of text.split('\n')) {
    if (line.startsWith('event: ')) {
      currentEvent = line.slice(7).trim();
    } else if (line.startsWith('data: ')) {
      currentData = line.slice(6);
    } else if (line === '' && currentData) {
      messages.push({ event: currentEvent, data: currentData });
      currentEvent = 'message';
      currentData = '';
    }
    // Ignore heartbeat comments (lines starting with ':')
  }

  return messages;
}

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

    let aborted = false;
    let reconnectTimeout: ReturnType<typeof setTimeout>;
    const eventNames = new Set<string>(SSE_EVENTS);

    async function connect() {
      if (aborted) return;
      try {
        const response = await fetch('/api/events', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok || !response.body) {
          setConnected(false);
          if (!aborted) reconnectTimeout = setTimeout(connect, 3000);
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done || aborted) break;

          buffer += decoder.decode(value, { stream: true });
          // Process complete messages (separated by double newline)
          const parts = buffer.split('\n\n');
          buffer = parts.pop() ?? '';

          for (const part of parts) {
            const messages = parseSSE(part + '\n\n');
            for (const msg of messages) {
              if (msg.event === 'connected') {
                setConnected(true);
              } else if (eventNames.has(msg.event)) {
                try {
                  stableHandler(msg.event, JSON.parse(msg.data));
                } catch {
                  // ignore parse errors
                }
              }
            }
          }
        }
      } catch {
        // Network error
      }
      setConnected(false);
      if (!aborted) reconnectTimeout = setTimeout(connect, 3000);
    }

    connect();

    return () => {
      aborted = true;
      clearTimeout(reconnectTimeout);
      setConnected(false);
    };
  }, [stableHandler]);

  return { connected };
}
