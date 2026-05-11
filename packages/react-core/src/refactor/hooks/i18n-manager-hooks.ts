import { useSyncExternalStore } from "react";
import { useI18nExternalStore } from "../context/provider/GTContext";
import type { Translation } from "gt-i18n/types";
import type {
  TranslateLookup,
  TranslateManySnapshot,
  TranslateSnapshot,
  DictionaryLookup,
  DictionaryEntrySnapshot,
  DictionaryObjectSnapshot,
} from "../context/store/storeTypes";
import type { CustomMapping } from "generaltranslation/types";
import { getI18nExternalStore } from "../context/store/singleton-operations";

export function useTranslate<T extends Translation>(
  lookup: TranslateLookup<T>,
): TranslateSnapshot<T> {
  const store = useI18nExternalStore();
  return useSyncExternalStore(
    (listener) => store.subscribeToTranslate(lookup, listener),
    () => store.getTranslateSnapshot(lookup),
    () => store.getTranslateSnapshot(lookup),
  );
}

export function useTranslateMany<T extends Translation>(
  lookups: readonly TranslateLookup<T>[],
): TranslateManySnapshot<T> {
  const store = useI18nExternalStore();
  return useSyncExternalStore(
    (listener) => store.subscribeToTranslateMany(lookups, listener),
    () => store.getTranslateManySnapshot(lookups),
    () => store.getTranslateManySnapshot(lookups),
  );
}

export function useDictionaryEntry(
  lookup: DictionaryLookup,
): DictionaryEntrySnapshot {
  const store = useI18nExternalStore();
  return useSyncExternalStore(
    (listener) => store.subscribeToDictionaryEntry(lookup, listener),
    () => store.getDictionaryEntrySnapshot(lookup),
    () => store.getDictionaryEntrySnapshot(lookup),
  );
}

export function useDictionaryObject(
  lookup: DictionaryLookup,
): DictionaryObjectSnapshot {
  const store = useI18nExternalStore();
  return useSyncExternalStore(
    (listener) => store.subscribeToDictionaryObject(lookup, listener),
    () => store.getDictionaryObjectSnapshot(lookup),
    () => store.getDictionaryObjectSnapshot(lookup),
  );
}

export function useCustomMapping(): CustomMapping {
  const store = useI18nExternalStore();
  return useSyncExternalStore(
    store.subscribeToCustomMapping,
    store.getCustomMappingSnapshot,
    store.getCustomMappingSnapshot,
  );
}

export function useEnableI18n(): boolean {
  const store = useI18nExternalStore();
  return useSyncExternalStore(
    store.subscribeToEnableI18n,
    store.getEnableI18nSnapshot,
    store.getEnableI18nSnapshot,
  );
}

export function useDefaultLocale(): string {
  const store = getI18nExternalStore();
  return useSyncExternalStore(
    store.subscribeToDefaultLocale,
    store.getDefaultLocaleSnapshot,
    store.getDefaultLocaleSnapshot,
  );
}

export function useLocales(): readonly string[] {
  const store = getI18nExternalStore();
  return useSyncExternalStore(
    store.subscribeToLocales,
    store.getLocalesSnapshot,
    store.getLocalesSnapshot,
  );
}
