import { use, useMemo, useSyncExternalStore } from 'react';
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
import { useLookupAdapter } from '../i18n-store/lookup-adapter/useLookupAdapter';
import {
  useDictionariesSnapshot,
  useI18nStore,
  useTranslationsSnapshot,
} from '../i18n-store/useI18nStore';
import { getI18nConfig } from 'gt-i18n/internal';

/**
 * @internal
 */
export function useTranslate<T extends Translation>(
  lookup: TranslateLookup<T>
): TranslateSnapshot<T> {
  const i18nStore = useI18nStore();
  const translationsSnapshot = useTranslationsSnapshot();

  /**
   * TODO: for snapshot lookup, we can use the translation snapshot
   * to avoid the adapter.resolveTranslation call.
   */
  const storeTranslation = useSyncExternalStore(
    (listener) => i18nStore.subscribeToTranslate(lookup, listener),
    () => i18nStore.getTranslateSnapshot(lookup, translationsSnapshot),
    () => i18nStore.getTranslateSnapshot(lookup, translationsSnapshot)
  );

  if (storeTranslation == null && getI18nConfig().isDevHotReloadEnabled()) {
    // TODO: (separate PR): add configuration for a use() + suspense strategy
    i18nStore.translate(lookup);
  }

  return storeTranslation;
}

/**
 * @internal
 */
export function useTranslateMany<T extends Translation>(
  lookups: readonly TranslateLookup<T>[]
): TranslateManySnapshot<T> {
  const adapter = useLookupAdapter();
  const i18nStore = useI18nStore();
  const translationsSnapshot = useTranslationsSnapshot();

  const translations = useSyncExternalStore(
    (listener) => i18nStore.subscribeToTranslateMany(lookups, listener),
    () => i18nStore.getTranslateManySnapshot(lookups, translationsSnapshot),
    () => i18nStore.getTranslateManySnapshot(lookups, translationsSnapshot)
  );

  translations.forEach((translation, index) => {
    if (translation == null) {
      adapter.handleMissingTranslation?.(lookups[index]);
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
  const adapter = useLookupAdapter();
  const i18nStore = useI18nStore();
  const dictionariesSnapshot = useDictionariesSnapshot();

  const dictionaryEntry = useSyncExternalStore(
    (listener) => i18nStore.subscribeToDictionaryEntry(lookup, listener),
    () => i18nStore.getDictionaryEntrySnapshot(lookup, dictionariesSnapshot),
    () => i18nStore.getDictionaryEntrySnapshot(lookup, dictionariesSnapshot)
  );

  if (dictionaryEntry == null) {
    adapter.handleMissingDictionaryEntry?.(lookup);
  }

  return dictionaryEntry;
}

/**
 * @internal
 */
export function useDictionaryObject(
  lookup: DictionaryLookup
): DictionaryObjectSnapshot {
  const adapter = useLookupAdapter();
  const i18nStore = useI18nStore();
  const dictionariesSnapshot = useDictionariesSnapshot();

  const dictionaryObject = useSyncExternalStore(
    (listener) => i18nStore.subscribeToDictionaryObject(lookup, listener),
    () => i18nStore.getDictionaryObjectSnapshot(lookup, dictionariesSnapshot),
    () => i18nStore.getDictionaryObjectSnapshot(lookup, dictionariesSnapshot)
  );

  if (dictionaryObject == null) {
    adapter.handleMissingDictionaryObject?.(lookup);
  }

  return dictionaryObject;
}

/**
 * Used for dev translation tracking
 *
 * This is used for hot reload and thus does not need
 * to access the snapshots
 */
export function useRuntimeTranslationScope(): RuntimeTranslationScope {
  const adapter = useLookupAdapter();

  const scope = useMemo(() => {
    return adapter.createRuntimeTranslationScope();
  }, [adapter]);

  useSyncExternalStore(scope.subscribe, scope.getSnapshot, scope.getSnapshot);

  return scope;
}

/**
 * Used for dev dictionary tracking
 *
 * This is used for hot reload and thus does not need
 * to access the snapshots
 */
export function useRuntimeDictionaryScope(): RuntimeDictionaryScope {
  const adapter = useLookupAdapter();

  const scope = useMemo(() => {
    return adapter.createRuntimeDictionaryScope();
  }, [adapter]);

  useSyncExternalStore(scope.subscribe, scope.getSnapshot, scope.getSnapshot);

  return scope;
}
