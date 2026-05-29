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
import {
  lookupRenderDictionaryEntry,
  lookupRenderDictionaryObject,
  lookupRenderTranslation,
  useRenderSnapshot,
} from '../context/render-snapshot';

/**
 * @internal
 */
export function useTranslate<T extends Translation>(
  lookup: TranslateLookup<T>
): TranslateSnapshot<T> {
  const renderSnapshot = useRenderSnapshot();
  const store = getI18nStore();
  const storeTranslation = useSyncExternalStore(
    (listener) => store.subscribeToTranslate(lookup, listener),
    () => store.getTranslateSnapshot(lookup),
    () => store.getTranslateSnapshot(lookup)
  );
  const translation =
    lookupRenderTranslation(renderSnapshot, lookup) ?? storeTranslation;
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
  const renderSnapshot = useRenderSnapshot();
  const store = getI18nStore();
  const storeTranslations = useSyncExternalStore(
    (listener) => store.subscribeToTranslateMany(lookups, listener),
    () => store.getTranslateManySnapshot(lookups),
    () => store.getTranslateManySnapshot(lookups)
  );
  const translations = lookups.map(
    (lookup, index) =>
      lookupRenderTranslation(renderSnapshot, lookup) ??
      storeTranslations[index]
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
  const renderSnapshot = useRenderSnapshot();
  const store = getI18nStore();
  const storeDictionaryEntry = useSyncExternalStore(
    (listener) => store.subscribeToDictionaryEntry(lookup, listener),
    () => store.getDictionaryEntrySnapshot(lookup),
    () => store.getDictionaryEntrySnapshot(lookup)
  );
  const dictionaryEntry =
    lookupRenderDictionaryEntry(renderSnapshot, lookup) ?? storeDictionaryEntry;
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
  const renderSnapshot = useRenderSnapshot();
  const store = getI18nStore();
  const storeDictionaryObject = useSyncExternalStore(
    (listener) => store.subscribeToDictionaryObject(lookup, listener),
    () => store.getDictionaryObjectSnapshot(lookup),
    () => store.getDictionaryObjectSnapshot(lookup)
  );
  const dictionaryObject =
    lookupRenderDictionaryObject(renderSnapshot, lookup) ??
    storeDictionaryObject;
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
