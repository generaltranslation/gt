import { useMemo, useSyncExternalStore } from 'react';
import type { Dictionary, Translation } from 'gt-i18n/types';
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
import { useGTContext } from '../context/context';
import { hashMessage } from 'gt-i18n/internal';
import { Hash, Locale } from 'gt-i18n/internal/types';

/**
 * @internal
 */
export function useTranslate<T extends Translation>(
  lookup: TranslateLookup<T>
): TranslateSnapshot<T> {
  const { i18nStore, translationsSnapshot } = useGTContext();
  const translation = useSyncExternalStore(
    (listener) => i18nStore.subscribeToTranslate(lookup, listener),
    () => i18nStore.getTranslateSnapshot(lookup),
    () => i18nStore.getTranslateSnapshot(lookup)
  );
  if (translation == null && getReactI18nCache().isDevHotReloadEnabled()) {
    i18nStore.translate(lookup);
  }
  return lookupTranslation(translationsSnapshot, lookup) ?? translation;
}

/**
 * @internal
 */
export function useTranslateMany<T extends Translation>(
  lookups: readonly TranslateLookup<T>[]
): TranslateManySnapshot<T> {
  const { i18nStore, translationsSnapshot } = useGTContext();
  const translation = useSyncExternalStore(
    (listener) => i18nStore.subscribeToTranslateMany(lookups, listener),
    () => i18nStore.getTranslateManySnapshot(lookups),
    () => i18nStore.getTranslateManySnapshot(lookups)
  );

  const devHotReloadEnabled = getReactI18nCache().isDevHotReloadEnabled();
  if (devHotReloadEnabled) {
    translation.forEach((translation, index) => {
      if (translation == null) {
        i18nStore.translate(lookups[index]);
      }
    });
  }
  return lookups.map(
    (lookup, index) =>
      lookupTranslation(translationsSnapshot, lookup) ?? translation[index]
  );
}

/**
 * @internal
 */
export function useDictionaryEntry(
  lookup: DictionaryLookup
): DictionaryEntrySnapshot {
  const { i18nStore, dictionariesSnapshot } = useGTContext();
  const dictionaryEntry = useSyncExternalStore(
    (listener) => i18nStore.subscribeToDictionaryEntry(lookup, listener),
    () => i18nStore.getDictionaryEntrySnapshot(lookup),
    () => i18nStore.getDictionaryEntrySnapshot(lookup)
  );
  if (dictionaryEntry == null && getReactI18nCache().isDevHotReloadEnabled()) {
    i18nStore.translateDictionaryEntry(lookup);
  }
  return lookupDictionaryEntry(dictionariesSnapshot, lookup) ?? dictionaryEntry;
}

/**
 * @internal
 */
export function useDictionaryObject(
  lookup: DictionaryLookup
): DictionaryObjectSnapshot {
  const { i18nStore, dictionariesSnapshot } = useGTContext();
  const dictionaryObject = useSyncExternalStore(
    (listener) => i18nStore.subscribeToDictionaryObject(lookup, listener),
    () => i18nStore.getDictionaryObjectSnapshot(lookup),
    () => i18nStore.getDictionaryObjectSnapshot(lookup)
  );
  if (dictionaryObject == null && getReactI18nCache().isDevHotReloadEnabled()) {
    i18nStore.translateDictionaryObject(lookup);
  }
  return (
    lookupDictionaryObject(dictionariesSnapshot, lookup) ?? dictionaryObject
  );
}

/**
 * Used for dev translation tracking
 *
 * This is used for hot reload and thus does not need
 * to access the snapshots
 */
export function useRuntimeTranslationScope(): RuntimeTranslationScope {
  const { i18nStore } = useGTContext();

  const scope = useMemo(() => {
    return i18nStore.createRuntimeTranslationScope();
  }, [i18nStore]);

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
  const { i18nStore } = useGTContext();

  const scope = useMemo(() => {
    return i18nStore.createRuntimeDictionaryScope();
  }, [i18nStore]);

  useSyncExternalStore(scope.subscribe, scope.getSnapshot, scope.getSnapshot);

  return scope;
}

// ===== Utilities ===== //

function lookupTranslation<T extends Translation>(
  translationsSnapshot: Record<Locale, Record<Hash, Translation>>,
  lookup: TranslateLookup<T>
): TranslateSnapshot<T> {
  const hash =
    lookup.options.$_hash ?? hashMessage(lookup.message, lookup.options);
  return translationsSnapshot?.[lookup.locale]?.[hash] as TranslateSnapshot<T>;
}

function lookupDictionaryEntry(
  dictionariesSnapshot: Record<Locale, Dictionary>,
  lookup: DictionaryLookup
): DictionaryEntrySnapshot {
  throw new Error('Not implemented');
}

function lookupDictionaryObject(
  dictionariesSnapshot: Record<Locale, Dictionary>,
  lookup: DictionaryLookup
): DictionaryObjectSnapshot {
  throw new Error('Not implemented');
}
