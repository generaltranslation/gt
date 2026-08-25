import { useCallback, useRef } from 'react';
import { getDictionaryListenerKey, getI18nConfig } from 'gt-i18n/internal';
import { useDictionariesSnapshot } from '../../context/context';
import {
  getDictionaryEntrySnapshot,
  getDictionaryObjectSnapshot,
} from '../../i18n-cache/snapshots';
import { getReactI18nCache } from '../../i18n-cache/singleton-operations';
import type {
  DictionaryEntrySnapshot,
  DictionaryLookup,
  DictionaryObjectSnapshot,
} from '../../i18n-cache/types';
import { useHandleMissingDictionary } from '../utils/missing-translation';
import { useSubscribeToTrackedLookups } from './useSubscribeToTrackedLookups';

type TrackedDictionaryResolvers = {
  entry: (lookup: DictionaryLookup) => DictionaryEntrySnapshot;
  object: (lookup: DictionaryLookup) => DictionaryObjectSnapshot;
};

export function useTrackedDictionaryResolvers(): TrackedDictionaryResolvers {
  const dictionaries = useDictionariesSnapshot();
  const cache = getReactI18nCache();
  const devHotReloadEnabled =
    process.env.NODE_ENV !== 'production' &&
    getI18nConfig().isDevHotReloadEnabled();
  const onMissing = useHandleMissingDictionary();
  const trackedKeysRef = useRef<Set<string> | null>(null);
  if (trackedKeysRef.current === null) trackedKeysRef.current = new Set();

  useSubscribeToTrackedLookups(trackedKeysRef, cache.subscribe, (event) =>
    event.type !== 'translation' ? getDictionaryListenerKey(event) : undefined
  );

  const entry = useCallback(
    (lookup: DictionaryLookup): DictionaryEntrySnapshot => {
      if (devHotReloadEnabled) {
        trackedKeysRef.current!.add(getDictionaryListenerKey(lookup));
      }
      const value = getDictionaryEntrySnapshot(cache, dictionaries, lookup);
      if (value === undefined && devHotReloadEnabled) {
        onMissing.dictionaryEntry(lookup);
      }
      return value;
    },
    [cache, dictionaries, devHotReloadEnabled, onMissing.dictionaryEntry]
  );

  const object = useCallback(
    (lookup: DictionaryLookup): DictionaryObjectSnapshot => {
      if (devHotReloadEnabled) {
        trackedKeysRef.current!.add(getDictionaryListenerKey(lookup));
      }
      const value = getDictionaryObjectSnapshot(cache, dictionaries, lookup);
      if (value === undefined && devHotReloadEnabled) {
        onMissing.dictionaryObject(lookup);
      }
      return value;
    },
    [cache, dictionaries, devHotReloadEnabled, onMissing.dictionaryObject]
  );

  return { entry, object };
}
