import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import { getTranslateListenerKey } from 'gt-i18n/internal';
import type { Translation } from 'gt-i18n/types';
import type { TranslateLookup, TranslateSnapshot } from '../storeTypes';
import { useLookupAdapter } from './useLookupAdapter';

export type TrackedTranslationResolver = {
  track: <T extends Translation>(lookup: TranslateLookup<T>) => void;
  resolve: <T extends Translation>(
    lookup: TranslateLookup<T>
  ) => TranslateSnapshot<T>;
  handleMissing: <T extends Translation>(lookup: TranslateLookup<T>) => void;
};

export function useTrackedTranslationResolver(): TrackedTranslationResolver {
  const adapter = useLookupAdapter();
  /**
   * Track lookups per hook instance without updating React state during render.
   * The version ref is only an invalidation counter for useSyncExternalStore.
   */
  const trackedKeysRef = useRef(new Set<string>());
  const versionRef = useRef(0);

  const getSnapshot = useCallback(() => {
    return versionRef.current;
  }, []);

  useSyncExternalStore(
    useCallback(
      (listener) => {
        return adapter.subscribeToTranslationEvents((lookup) => {
          const key = getTranslateListenerKey(lookup);
          if (!trackedKeysRef.current.has(key)) return;
          versionRef.current++;
          listener();
        });
      },
      [adapter]
    ),
    getSnapshot,
    getSnapshot
  );

  return useMemo(
    () => ({
      track: (lookup) => {
        trackedKeysRef.current.add(getTranslateListenerKey(lookup));
      },
      resolve: (lookup) => {
        const storeTranslation = adapter.getStoreTranslation(lookup);
        return adapter.resolveTranslation(lookup, storeTranslation);
      },
      handleMissing: (lookup) => {
        adapter.handleMissingTranslation?.(lookup);
      },
    }),
    [adapter]
  );
}
