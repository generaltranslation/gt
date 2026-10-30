import { getDictionaryListenerKey, getI18nConfig } from 'gt-i18n/internal';
import type { DictionaryLookup, DictionaryObjectSnapshot } from './types';
import { useCallback, useRef } from 'react';
import { useHandleMissingDictionaryObject } from './missing-dictionary';
import { useDictionaryContext } from './DictionaryContext';
import { useSubscribeToTrackedLookups } from '../hooks/external-store/useSubscribeToTrackedLookups';

export type TrackedDictionaryObjResolver = (
  lookup: DictionaryLookup
) => DictionaryObjectSnapshot;

// TODO: rename to useTrackedDictionaryObjectResolver
export function useTrackedDictionaryObjResolver(): TrackedDictionaryObjResolver {
  const { dictionariesSnapshot, compatStore } = useDictionaryContext();
  const devHotReloadEnabled =
    process.env.NODE_ENV !== 'production' &&
    getI18nConfig().isDevHotReloadEnabled();
  const onMissingDictionaryObj = useHandleMissingDictionaryObject();

  const trackedKeysRef = useRef<Set<string> | null>(null);
  if (trackedKeysRef.current == null) {
    trackedKeysRef.current = new Set();
  }

  // subscribe to dictionary object updates
  useSubscribeToTrackedLookups(
    trackedKeysRef,
    compatStore.subscribeToDictionaryObjectEvents,
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
      const dictionaryObject = compatStore.getDictionaryObjectSnapshot(
        lookup,
        dictionariesSnapshot
      );

      // Hot reload
      if (dictionaryObject == null && devHotReloadEnabled) {
        onMissingDictionaryObj(lookup);
      }

      return dictionaryObject;
    },
    [
      compatStore,
      dictionariesSnapshot,
      devHotReloadEnabled,
      onMissingDictionaryObj,
    ]
  );
}
