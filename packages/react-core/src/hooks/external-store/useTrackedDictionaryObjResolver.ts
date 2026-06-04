import { getDictionaryListenerKey, getI18nConfig } from 'gt-i18n/internal';
import { useShouldTranslate } from '../utils';
import type {
  DictionaryLookup,
  DictionaryObjectSnapshot,
  StoreListener,
} from '../../i18n-store/storeTypes';
import {
  useDictionariesSnapshot,
  useI18nStore,
} from '../../i18n-store/useI18nStore';
import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useSyncExternalStore,
} from 'react';

export type TrackedDictionaryObjResolver = (
  lookup: DictionaryLookup
) => DictionaryObjectSnapshot;

export type OnMissingDictionaryObj = (lookup: DictionaryLookup) => void;

export function useTrackedDictionaryObjResolver(
  onMissingDictionaryObj: OnMissingDictionaryObj = () => {}
): TrackedDictionaryObjResolver {
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
      i18nStore.translateDictionaryObject(lookup);
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
      const dictionaryObject = i18nStore.getDictionaryObjectSnapshot(
        lookup,
        dictionariesSnapshot
      );

      // Hot reload
      if (dictionaryObject == null && devHotReloadEnabled) {
        pendingLookups.set(lookupKey, lookup);
        onMissingDictionaryObj(lookup);
      }

      return dictionaryObject;
    },
    [
      i18nStore,
      dictionariesSnapshot,
      devHotReloadEnabled,
      pendingLookups,
      onMissingDictionaryObj,
    ]
  );
}

function useSubscribeToLookups(trackedKeysRef: RefObject<Set<string> | null>) {
  // invalidation counter for triggering updates
  const versionRef = useRef(0);
  const i18nStore = useI18nStore();
  const subscribe = useCallback(
    (listener: StoreListener) => {
      return i18nStore.subscribeToDictionaryObjectEvents((lookup) => {
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
