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
import type { RuntimeTranslationScope } from '../i18n-store/RuntimeTranslationScope';
import type { RuntimeDictionaryScope } from '../i18n-store/RuntimeDictionaryScope';
import { getReactI18nCache } from '../i18n-cache/singleton-operations';
import { useI18nStoreWithFallback } from '../i18n-store/context';

/**
 * @internal
 */
export function useTranslate<T extends Translation>(
  lookup: TranslateLookup<T>
): TranslateSnapshot<T> {
  const store = useI18nStoreWithFallback();
  const translation = useSyncExternalStore(
    (listener) => store.subscribeToTranslate(lookup, listener),
    () => store.getTranslateSnapshot(lookup),
    () => store.getTranslateSnapshot(lookup)
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
  const store = useI18nStoreWithFallback();
  const translations = useSyncExternalStore(
    (listener) => store.subscribeToTranslateMany(lookups, listener),
    () => store.getTranslateManySnapshot(lookups),
    () => store.getTranslateManySnapshot(lookups)
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
  const store = useI18nStoreWithFallback();
  const dictionaryEntry = useSyncExternalStore(
    (listener) => store.subscribeToDictionaryEntry(lookup, listener),
    () => store.getDictionaryEntrySnapshot(lookup),
    () => store.getDictionaryEntrySnapshot(lookup)
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
  const store = useI18nStoreWithFallback();
  const dictionaryObject = useSyncExternalStore(
    (listener) => store.subscribeToDictionaryObject(lookup, listener),
    () => store.getDictionaryObjectSnapshot(lookup),
    () => store.getDictionaryObjectSnapshot(lookup)
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
  const store = useI18nStoreWithFallback();

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
  const store = useI18nStoreWithFallback();

  const scope = useMemo(() => {
    return store.createRuntimeDictionaryScope();
  }, [store]);

  useSyncExternalStore(scope.subscribe, scope.getSnapshot, scope.getSnapshot);

  return scope;
}
