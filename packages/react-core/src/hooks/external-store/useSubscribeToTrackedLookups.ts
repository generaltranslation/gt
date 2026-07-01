import {
  type RefObject,
  useCallback,
  useRef,
  useSyncExternalStore,
} from 'react';
import type { StoreListener, Unsubscribe } from '../../i18n-store/storeTypes';

/**
 * Subscribe to store events, but only trigger re-renders when the event's
 * lookup is in the tracked keys set. Shared by the tracked translation and
 * dictionary resolvers, which differ only in the store subscribe method and the
 * listener-key function.
 *
 * Remember that we can make no assumptions about when the tracked set gets
 * updated. This is technically not pure, but it is an acceptable trade since it
 * only drives dev translation hot reload.
 */
export function useSubscribeToTrackedLookups<L>(
  trackedKeysRef: RefObject<Set<string> | null>,
  subscribeToEvents: (onEvent: (lookup: L) => void) => Unsubscribe,
  getListenerKey: (lookup: L) => string
) {
  // invalidation counter for triggering updates
  const versionRef = useRef(0);
  const subscribe = useCallback(
    (listener: StoreListener) =>
      subscribeToEvents((lookup) => {
        if (!trackedKeysRef.current!.has(getListenerKey(lookup))) return;
        versionRef.current++;
        listener();
      }),
    [subscribeToEvents, getListenerKey, trackedKeysRef]
  );
  const getSnapshot = useCallback(() => versionRef.current, []);

  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
