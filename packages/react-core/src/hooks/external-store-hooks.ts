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
import type { CustomMapping } from 'generaltranslation/types';
import { getI18nStore } from '../i18n-store/singleton-operations';
import type { RuntimeTranslationScope } from '../i18n-store/RuntimeTranslationScope';
import type { RuntimeDictionaryScope } from '../i18n-store/RuntimeDictionaryScope';
import { getReactI18nCache } from '../i18n-cache/singleton-operations';

/**
 * @internal
 */
export function useTranslate<T extends Translation>(
  lookup: TranslateLookup<T>
): TranslateSnapshot<T> {
  const store = getI18nStore();
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
  const store = getI18nStore();
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
  const store = getI18nStore();
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
  const store = getI18nStore();
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

export function useCustomMapping(): CustomMapping {
  const store = getI18nStore();
  return useSyncExternalStore(
    store.subscribeToCustomMapping,
    store.getCustomMappingSnapshot,
    store.getCustomMappingSnapshot
  );
}

export function useDefaultLocale(): string {
  const store = getI18nStore();
  return useSyncExternalStore(
    store.subscribeToDefaultLocale,
    store.getDefaultLocaleSnapshot,
    store.getDefaultLocaleSnapshot
  );
}

export function useLocales(): readonly string[] {
  const store = getI18nStore();
  return useSyncExternalStore(
    store.subscribeToLocales,
    store.getLocalesSnapshot,
    store.getLocalesSnapshot
  );
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
