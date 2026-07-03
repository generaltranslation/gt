import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Subscribe = (listener: () => void) => () => void;
type GetSnapshot = () => number;

const reactMocks = vi.hoisted(() => ({
  useCallback: vi.fn(
    <T extends (...args: unknown[]) => unknown>(callback: T) => callback
  ),
  useRef: vi.fn(<T>(initialValue: T) => ({ current: initialValue })),
  useSyncExternalStore: vi.fn(),
}));

vi.mock('react', () => reactMocks);

const originalNodeEnv = process.env.NODE_ENV;

describe('useSubscribeToTrackedLookups', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('does not subscribe to tracked lookup events in production', async () => {
    process.env.NODE_ENV = 'production';
    const subscribeToEvents = vi.fn(() => vi.fn());
    const { useSubscribeToTrackedLookups } =
      await import('../useSubscribeToTrackedLookups');

    useSubscribeToTrackedLookups(
      { current: new Set(['matching-key']) },
      subscribeToEvents,
      (lookup: { key: string }) => lookup.key
    );

    expect(subscribeToEvents).not.toHaveBeenCalled();
    expect(reactMocks.useSyncExternalStore).not.toHaveBeenCalled();
  });

  it('subscribes and filters tracked lookup events in development', async () => {
    process.env.NODE_ENV = 'development';
    const listener = vi.fn();
    const unsubscribe = vi.fn();
    let onEvent: ((lookup: { key: string }) => void) | undefined;
    const subscribeToEvents = vi.fn((callback) => {
      onEvent = callback;
      return unsubscribe;
    });

    reactMocks.useSyncExternalStore.mockImplementationOnce(
      (subscribe: Subscribe, getSnapshot: GetSnapshot) => {
        expect(subscribe(listener)).toBe(unsubscribe);
        return getSnapshot();
      }
    );
    const { useSubscribeToTrackedLookups } =
      await import('../useSubscribeToTrackedLookups');

    useSubscribeToTrackedLookups(
      { current: new Set(['matching-key']) },
      subscribeToEvents,
      (lookup: { key: string }) => lookup.key
    );

    expect(subscribeToEvents).toHaveBeenCalledTimes(1);

    onEvent?.({ key: 'other-key' });
    expect(listener).not.toHaveBeenCalled();

    onEvent?.({ key: 'matching-key' });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
