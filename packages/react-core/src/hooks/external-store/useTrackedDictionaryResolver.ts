import { useCallback, useRef } from 'react';
import {
  useDictionariesSnapshot,
  useI18nStore,
} from '../../i18n-store/useI18nStore';
import type {
  DictionaryEntrySnapshot,
  DictionaryLookup,
} from '../../i18n-store/storeTypes';
import {
  getDictionaryListenerKey,
  getI18nConfig,
  getI18nRuntime,
} from 'gt-i18n/internal';
import { useHandleMissingDictionaryEntry } from '../utils/missing-translation';
import { useSubscribeToTrackedLookups } from './useSubscribeToTrackedLookups';
import { lookupDictionaryEntry } from '../../i18n-store/utils/dictionaries';
import { useGTContext } from '../../context/context';

export type TrackedDictionaryEntryResolver = (
  lookup: DictionaryLookup
) => DictionaryEntrySnapshot;

// TODO: rename to useTrackedDictionaryEntryResolver
export function useTrackedDictionaryResolver(): TrackedDictionaryEntryResolver {
  const dictionariesSnapshot = useDictionariesSnapshot();
  const i18nStore = useI18nStore();
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
    i18nStore.subscribeToDictionaryEntryEvents,
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

function useSnapshotDictionaryResolver(): TrackedDictionaryEntryResolver {
  const context = useGTContext();
  return useCallback(
    (lookup) =>
      context
        ? lookupDictionaryEntry(context.dictionariesSnapshot, lookup)
        : getI18nRuntime().lookupDictionary(lookup.locale, lookup.id),
    [context]
  );
}

export const useDictionaryEntryResolver =
  process.env.NODE_ENV === 'production'
    ? useSnapshotDictionaryResolver
    : useTrackedDictionaryResolver;
