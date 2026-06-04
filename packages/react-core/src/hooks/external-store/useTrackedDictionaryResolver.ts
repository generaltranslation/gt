import { useCallback, useRef } from 'react';
import {
  useDictionariesSnapshot,
  useI18nStore,
} from '../../i18n-store/useI18nStore';
import type {
  DictionaryEntrySnapshot,
  DictionaryLookup,
  StoreListener,
} from '../../i18n-store/storeTypes';
import { getDictionaryListenerKey, getI18nConfig } from 'gt-i18n/internal';
import { useSyncExternalStore } from 'react';
import type { RefObject } from 'react';
import { useHandleMissingDictionaryEntry } from '../utils/missing-translation';

export type TrackedDictionaryEntryResolver = (
  lookup: DictionaryLookup
) => DictionaryEntrySnapshot;

// TODO: rename to useTrackedDictionaryEntryResolver
export function useTrackedDictionaryResolver(): TrackedDictionaryEntryResolver {
  const dictionariesSnapshot = useDictionariesSnapshot();
  const i18nStore = useI18nStore();
  const devHotReloadEnabled = getI18nConfig().isDevHotReloadEnabled();
  const onMissingDictionaryEntry = useHandleMissingDictionaryEntry();

  const trackedKeysRef = useRef<Set<string> | null>(null);
  if (trackedKeysRef.current == null) {
    trackedKeysRef.current = new Set();
  }

  // subscribe to dictionary entry updates
  useSubscribeToLookups(trackedKeysRef);

  // Resolution callback
  return useCallback(
    (lookup: DictionaryLookup) => {
      // Track the lookup for dev hot reload
      const lookupKey = getDictionaryListenerKey(lookup);
      if (devHotReloadEnabled) {
        trackedKeysRef.current!.add(lookupKey);
      }

      // Resolve the dictionary entry from the store
      const dictionaryEntry = i18nStore.getDictionaryEntrySnapshot(
        lookup,
        dictionariesSnapshot
      );

      // Hot reload
      if (dictionaryEntry == null && devHotReloadEnabled) {
        onMissingDictionaryEntry(lookup);
      }

      return dictionaryEntry;
    },
    [
      i18nStore,
      dictionariesSnapshot,
      devHotReloadEnabled,
      onMissingDictionaryEntry,
    ]
  );
}

function useSubscribeToLookups(trackedKeysRef: RefObject<Set<string> | null>) {
  // invalidation counter for triggering updates
  const versionRef = useRef(0);
  const i18nStore = useI18nStore();
  const subscribe = useCallback(
    (listener: StoreListener) => {
      return i18nStore.subscribeToDictionaryEntryEvents((lookup) => {
        const key = getDictionaryListenerKey(lookup);
        if (!trackedKeysRef.current!.has(key)) return;
        versionRef.current++;
        listener();
      });
    },
    [i18nStore]
  );
  const getSnapshot = useCallback(() => {
    return versionRef.current;
  }, []);

  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
