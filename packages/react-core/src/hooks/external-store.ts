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
import { useLookupAdapter } from '../i18n-store/lookup-adapter/useLookupAdapter';

/**
 * @internal
 */
export function useTranslate<T extends Translation>(
  lookup: TranslateLookup<T>
): TranslateSnapshot<T> {
  const adapter = useLookupAdapter();

  const storeTranslation = useSyncExternalStore(
    (listener) => adapter.subscribeToTranslate(lookup, listener),
    () => adapter.getStoreTranslation(lookup),
    () => adapter.getServerTranslation(lookup)
  );

  const translation = adapter.resolveTranslation(lookup, storeTranslation);

  if (translation == null) {
    adapter.handleMissingTranslation?.(lookup);
  }

  return translation;
}

/**
 * @internal
 */
export function useTranslateMany<T extends Translation>(
  lookups: readonly TranslateLookup<T>[]
): TranslateManySnapshot<T> {
  const adapter = useLookupAdapter();

  const storeTranslations = useSyncExternalStore(
    (listener) => adapter.subscribeToTranslateMany(lookups, listener),
    () => adapter.getStoreTranslations(lookups),
    () => adapter.getServerTranslations(lookups)
  );

  const translations = adapter.resolveTranslations(lookups, storeTranslations);

  adapter.handleMissingTranslations?.(lookups, translations);

  return translations;
}

/**
 * @internal
 */
export function useDictionaryEntry(
  lookup: DictionaryLookup
): DictionaryEntrySnapshot {
  const adapter = useLookupAdapter();

  const storeDictionaryEntry = useSyncExternalStore(
    (listener) => adapter.subscribeToDictionaryEntry(lookup, listener),
    () => adapter.getStoreDictionaryEntry(lookup),
    () => adapter.getServerDictionaryEntry(lookup)
  );

  const dictionaryEntry = adapter.resolveDictionaryEntry(
    lookup,
    storeDictionaryEntry
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

  const storeDictionaryObject = useSyncExternalStore(
    (listener) => adapter.subscribeToDictionaryObject(lookup, listener),
    () => adapter.getStoreDictionaryObject(lookup),
    () => adapter.getServerDictionaryObject(lookup)
  );

  const dictionaryObject = adapter.resolveDictionaryObject(
    lookup,
    storeDictionaryObject
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
