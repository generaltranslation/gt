import { useCallback, useRef } from 'react';
import type { DictionaryEntrySnapshot, DictionaryLookup } from './types';
import { getDictionaryListenerKey, getI18nConfig } from 'gt-i18n/internal';
import { useHandleMissingDictionaryEntry } from './missing-dictionary';
import { useDictionaryContext } from './DictionaryContext';
import { useSubscribeToTrackedLookups } from '../hooks/external-store/useSubscribeToTrackedLookups';

export type TrackedDictionaryEntryResolver = (
  lookup: DictionaryLookup
) => DictionaryEntrySnapshot;

// TODO: rename to useTrackedDictionaryEntryResolver
export function useTrackedDictionaryResolver(): TrackedDictionaryEntryResolver {
  const { dictionariesSnapshot, compatStore } = useDictionaryContext();
  const devHotReloadEnabled =
    process.env.NODE_ENV !== 'production' &&
    getI18nConfig().isDevHotReloadEnabled();
  const onMissingDictionaryEntry = useHandleMissingDictionaryEntry();

  const trackedKeysRef = useRef<Set<string> | null>(null);
  if (trackedKeysRef.current == null) {
    trackedKeysRef.current = new Set();
  }

  // subscribe to dictionary entry updates
  useSubscribeToTrackedLookups(
    trackedKeysRef,
    compatStore.subscribeToDictionaryEntryEvents,
    getDictionaryListenerKey
  );

  // Resolution callback
  return useCallback(
    (lookup: DictionaryLookup) => {
      // Track the lookup for dev hot reload
      const lookupKey = getDictionaryListenerKey(lookup);
      if (devHotReloadEnabled) {
        trackedKeysRef.current!.add(lookupKey);
      }

      // Resolve the dictionary entry from the store
      const dictionaryEntry = compatStore.getDictionaryEntrySnapshot(
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
      compatStore,
      dictionariesSnapshot,
      devHotReloadEnabled,
      onMissingDictionaryEntry,
    ]
  );
}
