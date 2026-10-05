import { useCallback, useSyncExternalStore } from 'react';
import type { ExampleState } from '../shared/types.ts';

/**
 * One EventSource per example, shared by every component that reads it.
 * The server pushes the full state after every build.
 */
interface Stream {
  state: ExampleState | null;
  connected: boolean;
  listeners: Set<() => void>;
  source: EventSource | null;
}

const streams = new Map<string, Stream>();

function streamFor(id: string): Stream {
  let stream = streams.get(id);
  if (!stream) {
    stream = {
      state: null,
      connected: false,
      listeners: new Set(),
      source: null,
    };
    streams.set(id, stream);
  }
  return stream;
}

function subscribe(id: string, listener: () => void) {
  const stream = streamFor(id);
  stream.listeners.add(listener);
  if (!stream.source) {
    const source = new EventSource(`/api/examples/${id}/events`);
    const notify = () => {
      for (const callback of stream.listeners) callback();
    };
    source.onmessage = (event) => {
      stream.state = JSON.parse(event.data) as ExampleState;
      stream.connected = true;
      notify();
    };
    source.onerror = () => {
      stream.connected = false;
      notify();
    };
    stream.source = source;
  }
  return () => {
    stream.listeners.delete(listener);
    // Close on the next tick so a remount (StrictMode, route change back)
    // keeps the open connection.
    setTimeout(() => {
      if (stream.listeners.size > 0) return;
      stream.source?.close();
      stream.source = null;
      stream.connected = false;
    }, 0);
  };
}

export function useExampleState(id: string): {
  state: ExampleState | null;
  connected: boolean;
} {
  const subscribeToId = useCallback(
    (listener: () => void) => subscribe(id, listener),
    [id]
  );
  const state = useSyncExternalStore(subscribeToId, () => streamFor(id).state);
  const connected = useSyncExternalStore(
    subscribeToId,
    () => streamFor(id).connected
  );
  return { state, connected };
}

/** Optimistically applies a server response so the UI does not wait for SSE. */
export function applyState(state: ExampleState) {
  const stream = streamFor(state.example);
  stream.state = state;
  for (const callback of stream.listeners) callback();
}
