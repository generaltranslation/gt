import { useSyncExternalStore } from "react";
import type { Translation } from "gt-i18n/types";
import type {
  TranslateLookup,
  TranslateManySnapshot,
  TranslateSnapshot,
  DictionaryLookup,
  DictionaryEntrySnapshot,
  DictionaryObjectSnapshot,
} from "../i18n-store/storeTypes";
import type { CustomMapping } from "generaltranslation/types";
import { getI18nStore } from "../i18n-store/singleton-operations";

/**
 * @internal
 */
export function useTranslate<T extends Translation>(
  lookup: TranslateLookup<T>,
): TranslateSnapshot<T> {
  const store = getI18nStore();
  const translation = useSyncExternalStore(
    (listener) => store.subscribeToTranslate(lookup, listener),
    () => store.getTranslateSnapshot(lookup),
    () => store.getTranslateSnapshot(lookup),
  );
  // TODO: add runtime translation
  // if (translation == null && isDevelopmentApiEnabled()) {
  if (translation == null) {
    store.translate(lookup);
  }
  return translation;
}

/**
 * @internal
 */
export function useTranslateMany<T extends Translation>(
  lookups: readonly TranslateLookup<T>[],
): TranslateManySnapshot<T> {
  const store = getI18nStore();
  return useSyncExternalStore(
    (listener) => store.subscribeToTranslateMany(lookups, listener),
    () => store.getTranslateManySnapshot(lookups),
    () => store.getTranslateManySnapshot(lookups),
  );
}

/**
 * @internal
 */
export function useDictionaryEntry(
  lookup: DictionaryLookup,
): DictionaryEntrySnapshot {
  const store = getI18nStore();
  return useSyncExternalStore(
    (listener) => store.subscribeToDictionaryEntry(lookup, listener),
    () => store.getDictionaryEntrySnapshot(lookup),
    () => store.getDictionaryEntrySnapshot(lookup),
  );
}

/**
 * @internal
 */
export function useDictionaryObject(
  lookup: DictionaryLookup,
): DictionaryObjectSnapshot {
  const store = getI18nStore();
  return useSyncExternalStore(
    (listener) => store.subscribeToDictionaryObject(lookup, listener),
    () => store.getDictionaryObjectSnapshot(lookup),
    () => store.getDictionaryObjectSnapshot(lookup),
  );
}

export function useCustomMapping(): CustomMapping {
  const store = getI18nStore();
  return useSyncExternalStore(
    store.subscribeToCustomMapping,
    store.getCustomMappingSnapshot,
    store.getCustomMappingSnapshot,
  );
}

export function useEnableI18n(): boolean {
  const store = getI18nStore();
  return useSyncExternalStore(
    store.subscribeToEnableI18n,
    store.getEnableI18nSnapshot,
    store.getEnableI18nSnapshot,
  );
}

export function useDefaultLocale(): string {
  const store = getI18nStore();
  return useSyncExternalStore(
    store.subscribeToDefaultLocale,
    store.getDefaultLocaleSnapshot,
    store.getDefaultLocaleSnapshot,
  );
}

export function useLocales(): readonly string[] {
  const store = getI18nStore();
  return useSyncExternalStore(
    store.subscribeToLocales,
    store.getLocalesSnapshot,
    store.getLocalesSnapshot,
  );
}
