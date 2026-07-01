import { getDictionaryListenerKey, getI18nConfig } from 'gt-i18n/internal';
import type {
  DictionaryLookup,
  DictionaryObjectSnapshot,
} from '../../i18n-store/storeTypes';
import {
  useDictionariesSnapshot,
  useI18nStore,
} from '../../i18n-store/useI18nStore';
import { useCallback, useRef } from 'react';
import { useHandleMissingDictionaryObject } from '../utils/missing-translation';
import { useSubscribeToTrackedLookups } from './useSubscribeToTrackedLookups';

export type TrackedDictionaryObjResolver = (
  lookup: DictionaryLookup
) => DictionaryObjectSnapshot;

// TODO: rename to useTrackedDictionaryObjectResolver
export function useTrackedDictionaryObjResolver(): TrackedDictionaryObjResolver {
  const dictionariesSnapshot = useDictionariesSnapshot();
  const i18nStore = useI18nStore();
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
    i18nStore.subscribeToDictionaryObjectEvents,
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
      const dictionaryObject = i18nStore.getDictionaryObjectSnapshot(
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
      i18nStore,
      dictionariesSnapshot,
      devHotReloadEnabled,
      onMissingDictionaryObj,
    ]
  );
}
