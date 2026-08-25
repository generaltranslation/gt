import {
  type RefObject,
  useCallback,
  useRef,
  useSyncExternalStore,
} from 'react';

type StoreListener = () => void;
type Unsubscribe = () => void;

type UseSubscribeToTrackedLookups = <L>(
  trackedKeysRef: RefObject<Set<string> | null>,
  subscribeToEvents: (onEvent: (lookup: L) => void) => Unsubscribe,
  getListenerKey: (lookup: L) => string | undefined
) => void;

/**
 * Subscribe to cache events, but only trigger re-renders when the event's
 * lookup is in the tracked keys set. Shared by the tracked translation and
 * dictionary resolvers, which differ only in the store subscribe method and the
 * listener-key function.
 *
 * Remember that we can make no assumptions about when the tracked set gets
 * updated. This is technically not pure, but it is an acceptable trade since it
 * only drives dev translation hot reload.
 */
function useSubscribeToTrackedLookupsDev<L>(
  trackedKeysRef: RefObject<Set<string> | null>,
  subscribeToEvents: (onEvent: (lookup: L) => void) => Unsubscribe,
  getListenerKey: (lookup: L) => string | undefined
) {
  // invalidation counter for triggering updates
  const versionRef = useRef(0);
  const subscribe = useCallback(
    (listener: StoreListener) => {
      return subscribeToEvents((lookup) => {
        const listenerKey = getListenerKey(lookup);
        if (!listenerKey || !trackedKeysRef.current!.has(listenerKey)) return;
        versionRef.current++;
        listener();
      });
    },
    [subscribeToEvents, getListenerKey, trackedKeysRef]
  );
  const getSnapshot = useCallback(() => versionRef.current, []);

  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

const useSubscribeToTrackedLookupsProd: UseSubscribeToTrackedLookups = () => {};

export const useSubscribeToTrackedLookups: UseSubscribeToTrackedLookups =
  process.env.NODE_ENV === 'production'
    ? useSubscribeToTrackedLookupsProd
    : useSubscribeToTrackedLookupsDev;
