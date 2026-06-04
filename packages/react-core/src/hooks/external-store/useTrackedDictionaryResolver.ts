import { useCallback, useEffect, useRef } from 'react';
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
import { useShouldTranslate } from '../utils';

export type TrackedDictionaryEntryResolver = (
  lookup: DictionaryLookup
) => DictionaryEntrySnapshot;

export type OnMissingDictionaryEntry = (lookup: DictionaryLookup) => void;

export function useTrackedDictionaryResolver(
  onMissingDictionaryEntry: OnMissingDictionaryEntry = () => {}
): TrackedDictionaryEntryResolver {
  const dictionariesSnapshot = useDictionariesSnapshot();
  const i18nStore = useI18nStore();
  const devHotReloadEnabled = getI18nConfig().isDevHotReloadEnabled();
  const shouldTranslate = useShouldTranslate();

  const trackedKeysRef = useRef<Set<string> | null>(null);
  if (trackedKeysRef.current == null) {
    trackedKeysRef.current = new Set();
  }

  // subscribe to dictionary entry updates
  useSubscribeToLookups(trackedKeysRef);

  // hot reload queue (reset on every render)
  // TODO: combine with other useEffects for dev hot reload
  const pendingLookups = new Map<string, DictionaryLookup>();
  useEffect(() => {
    if (pendingLookups.size === 0 || !shouldTranslate || !devHotReloadEnabled) {
      return;
    }
    pendingLookups.forEach((lookup) => {
      i18nStore.translateDictionaryEntry(lookup);
    });
  }, [i18nStore, pendingLookups, shouldTranslate, devHotReloadEnabled]);

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
        pendingLookups.set(lookupKey, lookup);
        onMissingDictionaryEntry(lookup);
      }

      return dictionaryEntry;
    },
    [
      i18nStore,
      dictionariesSnapshot,
      devHotReloadEnabled,
      pendingLookups, // TODO: maybe should use a wrapper or smth so we can cache cb
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
