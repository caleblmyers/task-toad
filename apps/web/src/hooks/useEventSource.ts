import { useState, useEffect, useCallback, useRef, createContext, useContext, createElement } from 'react';
import type { ReactNode } from 'react';

const SSE_EVENTS = [
  'task.created',
  'task.updated',
  'tasks.bulk_updated',
  'task.action_started',
  'task.action_completed',
  'task.action_plan_completed',
  'task.action_plan_failed',
  'task.blocked',
  'task.unblocked',
  'sprint.created',
  'sprint.updated',
  'sprint.closed',
  'notification.created',
  'approval.requested',
  'approval.decided',
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

// --- BroadcastChannel cross-tab SSE sharing ---

const CHANNEL_NAME = 'tasktoad-sse';
const HEARTBEAT_INTERVAL = 2000;
const HEARTBEAT_TIMEOUT = 5000;

type BroadcastMessage =
  | { type: 'leader-claim'; tabId: string }
  | { type: 'leader-heartbeat'; tabId: string }
  | { type: 'leader-resign'; tabId: string }
  | { type: 'sse-event'; event: string; data: string }
  | { type: 'sse-connected' };

function generateTabId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// --- SSE Context for single-connection deduplication ---

interface SSEContextValue {
  connected: boolean;
  subscribe: (handler: SSEEventHandler) => () => void;
}

const SSEContext = createContext<SSEContextValue | null>(null);

export function SSEProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const listenersRef = useRef<Set<SSEEventHandler>>(new Set());

  const subscribe = useCallback((handler: SSEEventHandler) => {
    listenersRef.current.add(handler);
    return () => {
      listenersRef.current.delete(handler);
    };
  }, []);

  useEffect(() => {
    // Check BroadcastChannel support — fall back to direct SSE if unavailable
    if (typeof BroadcastChannel === 'undefined') {
      return connectDirectSSE(listenersRef, setConnected);
    }

    const tabId = generateTabId();
    const channel = new BroadcastChannel(CHANNEL_NAME);
    let isLeader = false;
    let aborted = false;
    let sseCleanup: (() => void) | null = null;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let lastLeaderHeartbeat = 0;
    let leaderCheckTimer: ReturnType<typeof setInterval> | null = null;
    let electionTimeout: ReturnType<typeof setTimeout> | null = null;
    const eventNames = new Set<string>(SSE_EVENTS);

    function dispatch(event: string, data: unknown) {
      for (const listener of listenersRef.current) {
        listener(event, data);
      }
    }

    function startLeaderHeartbeat() {
      heartbeatTimer = setInterval(() => {
        if (isLeader && !aborted) {
          channel.postMessage({ type: 'leader-heartbeat', tabId } satisfies BroadcastMessage);
        }
      }, HEARTBEAT_INTERVAL);
    }

    function stopLeaderHeartbeat() {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
    }

    function becomeLeader() {
      if (isLeader || aborted) return;
      isLeader = true;
      channel.postMessage({ type: 'leader-claim', tabId } satisfies BroadcastMessage);
      startLeaderHeartbeat();
      stopLeaderCheck();

      // Start SSE connection as leader
      sseCleanup = connectLeaderSSE(eventNames, channel, listenersRef, setConnected, () => aborted);
    }

    function resignLeadership() {
      if (!isLeader) return;
      isLeader = false;
      stopLeaderHeartbeat();
      if (sseCleanup) {
        sseCleanup();
        sseCleanup = null;
      }
      setConnected(false);
    }

    function startLeaderCheck() {
      lastLeaderHeartbeat = Date.now();
      leaderCheckTimer = setInterval(() => {
        if (aborted) return;
        if (Date.now() - lastLeaderHeartbeat > HEARTBEAT_TIMEOUT && !isLeader) {
          // Leader seems dead, try to claim leadership after random delay
          stopLeaderCheck();
          const delay = Math.random() * 500;
          electionTimeout = setTimeout(() => {
            if (!aborted && !isLeader) {
              becomeLeader();
            }
          }, delay);
        }
      }, 1000);
    }

    function stopLeaderCheck() {
      if (leaderCheckTimer) {
        clearInterval(leaderCheckTimer);
        leaderCheckTimer = null;
      }
    }

    // Handle messages from other tabs
    channel.onmessage = (e: MessageEvent<BroadcastMessage>) => {
      const msg = e.data;
      switch (msg.type) {
        case 'leader-claim':
          if (msg.tabId !== tabId) {
            if (isLeader) {
              // Another tab claimed leadership — yield if their ID is higher (deterministic)
              if (msg.tabId > tabId) {
                resignLeadership();
                startLeaderCheck();
              }
            } else {
              // Reset heartbeat tracking for the new leader
              lastLeaderHeartbeat = Date.now();
              if (!leaderCheckTimer) startLeaderCheck();
            }
          }
          break;
        case 'leader-heartbeat':
          if (msg.tabId !== tabId) {
            lastLeaderHeartbeat = Date.now();
          }
          break;
        case 'leader-resign':
          if (msg.tabId !== tabId && !isLeader) {
            // Leader resigned, try to claim
            const delay = Math.random() * 500;
            electionTimeout = setTimeout(() => {
              if (!aborted && !isLeader) {
                becomeLeader();
              }
            }, delay);
          }
          break;
        case 'sse-event':
          if (!isLeader) {
            try {
              const parsed = JSON.parse(msg.data);
              dispatch(msg.event, parsed);
            } catch {
              // ignore parse errors
            }
          }
          break;
        case 'sse-connected':
          if (!isLeader) {
            setConnected(true);
          }
          break;
      }
    };

    // Try to become leader immediately
    becomeLeader();

    return () => {
      aborted = true;
      if (isLeader) {
        channel.postMessage({ type: 'leader-resign', tabId } satisfies BroadcastMessage);
      }
      resignLeadership();
      stopLeaderCheck();
      if (electionTimeout) clearTimeout(electionTimeout);
      channel.close();
      setConnected(false);
    };
  }, []);

  return createElement(SSEContext.Provider, { value: { connected, subscribe } }, children);
}

/** Leader tab's SSE connection — broadcasts events to other tabs */
function connectLeaderSSE(
  eventNames: Set<string>,
  channel: BroadcastChannel,
  listenersRef: React.RefObject<Set<SSEEventHandler>>,
  setConnected: (v: boolean) => void,
  isAborted: () => boolean,
): () => void {
  let aborted = false;
  let reconnectTimeout: ReturnType<typeof setTimeout>;

  function dispatch(event: string, data: unknown) {
    for (const listener of listenersRef.current!) {
      listener(event, data);
    }
  }

  async function connect() {
    if (aborted || isAborted()) return;
    try {
      const response = await fetch('/api/events', {
        credentials: 'include',
      });
      if (!response.ok || !response.body) {
        setConnected(false);
        if (!aborted && !isAborted()) reconnectTimeout = setTimeout(connect, 3000);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done || aborted || isAborted()) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          const messages = parseSSE(part + '\n\n');
          for (const msg of messages) {
            if (msg.event === 'connected') {
              setConnected(true);
              channel.postMessage({ type: 'sse-connected' } satisfies BroadcastMessage);
            } else if (eventNames.has(msg.event)) {
              try {
                const parsed = JSON.parse(msg.data);
                // Dispatch locally
                dispatch(msg.event, parsed);
                // Broadcast to other tabs
                channel.postMessage({
                  type: 'sse-event',
                  event: msg.event,
                  data: msg.data,
                } satisfies BroadcastMessage);
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
    if (!aborted && !isAborted()) reconnectTimeout = setTimeout(connect, 3000);
  }

  connect();

  return () => {
    aborted = true;
    clearTimeout(reconnectTimeout);
  };
}

/** Fallback: direct SSE connection without BroadcastChannel (same as original behavior) */
function connectDirectSSE(
  listenersRef: React.RefObject<Set<SSEEventHandler>>,
  setConnected: (v: boolean) => void,
): () => void {
  let aborted = false;
  let reconnectTimeout: ReturnType<typeof setTimeout>;
  const eventNames = new Set<string>(SSE_EVENTS);

  async function connect() {
    if (aborted) return;
    try {
      const response = await fetch('/api/events', {
        credentials: 'include',
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
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          const messages = parseSSE(part + '\n\n');
          for (const msg of messages) {
            if (msg.event === 'connected') {
              setConnected(true);
            } else if (eventNames.has(msg.event)) {
              try {
                const parsed = JSON.parse(msg.data);
                for (const listener of listenersRef.current!) {
                  listener(msg.event, parsed);
                }
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
}

/**
 * Subscribe to SSE events. Provide event types to filter, or omit to receive all.
 */
export function useSSEListener(
  eventTypes: readonly string[] | null,
  handler: SSEEventHandler,
): { connected: boolean } {
  const ctx = useContext(SSEContext);
  if (!ctx) throw new Error('useSSEListener must be used within <SSEProvider>');

  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  const eventTypesRef = useRef(eventTypes);
  eventTypesRef.current = eventTypes;

  useEffect(() => {
    const wrappedHandler: SSEEventHandler = (event, data) => {
      const types = eventTypesRef.current;
      if (!types || types.includes(event)) {
        handlerRef.current(event, data);
      }
    };
    return ctx.subscribe(wrappedHandler);
  }, [ctx]);

  return { connected: ctx.connected };
}

/**
 * @deprecated Use SSEProvider + useSSEListener instead. Kept for backward compatibility.
 */
export function useEventSource(onEvent: SSEEventHandler): { connected: boolean } {
  const [connected, setConnected] = useState(false);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const stableHandler = useCallback((eventName: string, data: unknown) => {
    onEventRef.current(eventName, data);
  }, []);

  useEffect(() => {
    let aborted = false;
    let reconnectTimeout: ReturnType<typeof setTimeout>;
    const eventNames = new Set<string>(SSE_EVENTS);

    async function connect() {
      if (aborted) return;
      try {
        const response = await fetch('/api/events', {
          credentials: 'include',
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
