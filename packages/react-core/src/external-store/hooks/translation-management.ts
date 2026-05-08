import { useSyncExternalStore } from 'react';
import { useI18nExternalStore } from '../provider/GTContext';
import type { Translation } from 'gt-i18n/types';
import type {
  TranslationLookup,
  TranslationSnapshot,
  DictionaryLookup,
  DictionaryEntrySnapshot,
  DictionaryObjectSnapshot,
} from '../store/storeTypes';

export function useTranslation<T extends Translation>(
  lookup: TranslationLookup<T>
): TranslationSnapshot<T> {
  const store = useI18nExternalStore();
  return useSyncExternalStore(
    (listener) => store.subscribeToTranslation(lookup, listener),
    () => store.getTranslationSnapshot(lookup),
    () => store.getTranslationSnapshot(lookup)
  );
}

export function useDictionaryEntry(
  lookup: DictionaryLookup
): DictionaryEntrySnapshot {
  const store = useI18nExternalStore();
  return useSyncExternalStore(
    (listener) => store.subscribeToDictionaryEntry(lookup, listener),
    () => store.getDictionaryEntrySnapshot(lookup),
    () => store.getDictionaryEntrySnapshot(lookup)
  );
}

export function useDictionaryObject(
  lookup: DictionaryLookup
): DictionaryObjectSnapshot {
  const store = useI18nExternalStore();
  return useSyncExternalStore(
    (listener) => store.subscribeToDictionaryObject(lookup, listener),
    () => store.getDictionaryObjectSnapshot(lookup),
    () => store.getDictionaryObjectSnapshot(lookup)
  );
}
