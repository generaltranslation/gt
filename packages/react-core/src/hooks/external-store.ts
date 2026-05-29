import { useMemo, useSyncExternalStore } from 'react';
import type { Translation } from 'gt-i18n/types';
import type {
  TranslateLookup,
  TranslateManySnapshot,
  TranslateSnapshot,
  DictionaryLookup,
  DictionaryEntrySnapshot,
  DictionaryObjectSnapshot,
} from '../i18n-store/storeTypes';
import { getI18nStore } from '../i18n-store/singleton-operations';
import type { RuntimeTranslationScope } from '../i18n-store/RuntimeTranslationScope';
import type { RuntimeDictionaryScope } from '../i18n-store/RuntimeDictionaryScope';
import { getReactI18nCache } from '../i18n-cache/singleton-operations';
import { useProviderI18nData } from '../context/provider-data';
import {
  lookupDictionaryObjectRecord,
  lookupDictionaryRecord,
  lookupTranslationRecord,
} from 'gt-i18n/internal';

/**
 * @internal
 */
export function useTranslate<T extends Translation>(
  lookup: TranslateLookup<T>
): TranslateSnapshot<T> {
  const store = getI18nStore();
  const providerData = useProviderI18nData();
  const getSnapshot = () =>
    lookupTranslationRecord(
      providerData?.translations,
      lookup.locale,
      lookup.message,
      lookup.options
    ) ?? store.getTranslateSnapshot(lookup);
  const translation = useSyncExternalStore(
    (listener) => store.subscribeToTranslate(lookup, listener),
    getSnapshot,
    getSnapshot
  );
  if (translation == null && getReactI18nCache().isDevHotReloadEnabled()) {
    store.translate(lookup);
  }
  return translation;
}

/**
 * @internal
 */
export function useTranslateMany<T extends Translation>(
  lookups: readonly TranslateLookup<T>[]
): TranslateManySnapshot<T> {
  const store = getI18nStore();
  const providerData = useProviderI18nData();
  const getSnapshot = useMemo(() => {
    let previousSnapshot: TranslateManySnapshot<T> | undefined;
    return () => {
      const nextSnapshot = lookups.map(
        (lookup) =>
          lookupTranslationRecord(
            providerData?.translations,
            lookup.locale,
            lookup.message,
            lookup.options
          ) ?? store.getTranslateSnapshot(lookup)
      );
      if (
        previousSnapshot &&
        previousSnapshot.length === nextSnapshot.length &&
        previousSnapshot.every((value, index) =>
          Object.is(value, nextSnapshot[index])
        )
      ) {
        return previousSnapshot;
      }
      previousSnapshot = nextSnapshot;
      return nextSnapshot;
    };
  }, [lookups, providerData?.translations, store]);
  const translations = useSyncExternalStore(
    (listener) => store.subscribeToTranslateMany(lookups, listener),
    getSnapshot,
    getSnapshot
  );
  const devHotReloadEnabled = getReactI18nCache().isDevHotReloadEnabled();
  translations.forEach((translation, index) => {
    if (translation == null && devHotReloadEnabled) {
      store.translate(lookups[index]);
    }
  });
  return translations;
}

/**
 * @internal
 */
export function useDictionaryEntry(
  lookup: DictionaryLookup
): DictionaryEntrySnapshot {
  const store = getI18nStore();
  const providerData = useProviderI18nData();
  const getSnapshot = () =>
    lookupDictionaryRecord(
      providerData?.dictionaries,
      lookup.locale,
      lookup.id
    ) ?? store.getDictionaryEntrySnapshot(lookup);
  const dictionaryEntry = useSyncExternalStore(
    (listener) => store.subscribeToDictionaryEntry(lookup, listener),
    getSnapshot,
    getSnapshot
  );
  if (dictionaryEntry == null && getReactI18nCache().isDevHotReloadEnabled()) {
    store.translateDictionaryEntry(lookup);
  }
  return dictionaryEntry;
}

/**
 * @internal
 */
export function useDictionaryObject(
  lookup: DictionaryLookup
): DictionaryObjectSnapshot {
  const store = getI18nStore();
  const providerData = useProviderI18nData();
  const getSnapshot = () =>
    lookupDictionaryObjectRecord(
      providerData?.dictionaries,
      lookup.locale,
      lookup.id
    ) ?? store.getDictionaryObjectSnapshot(lookup);
  const dictionaryObject = useSyncExternalStore(
    (listener) => store.subscribeToDictionaryObject(lookup, listener),
    getSnapshot,
    getSnapshot
  );
  if (dictionaryObject == null && getReactI18nCache().isDevHotReloadEnabled()) {
    store.translateDictionaryObject(lookup);
  }
  return dictionaryObject;
}

/**
 * Used for dev translation tracking
 */
export function useRuntimeTranslationScope(): RuntimeTranslationScope {
  const store = getI18nStore();

  const scope = useMemo(() => {
    return store.createRuntimeTranslationScope();
  }, [store]);

  useSyncExternalStore(scope.subscribe, scope.getSnapshot, scope.getSnapshot);

  return scope;
}

/**
 * Used for dev dictionary tracking
 */
export function useRuntimeDictionaryScope(): RuntimeDictionaryScope {
  const store = getI18nStore();

  const scope = useMemo(() => {
    return store.createRuntimeDictionaryScope();
  }, [store]);

  useSyncExternalStore(scope.subscribe, scope.getSnapshot, scope.getSnapshot);

  return scope;
}
