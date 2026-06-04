import { useMemo } from 'react';
import type { Translation } from 'gt-i18n/types';
import type {
  DictionaryEntrySnapshot,
  DictionaryLookup,
  DictionaryObjectSnapshot,
  TranslateLookup,
  TranslateSnapshot,
} from '../storeTypes';
import { useLookupAdapter } from './useLookupAdapter';

export type LookupResolver = {
  resolveTranslation: <T extends Translation>(
    lookup: TranslateLookup<T>
  ) => TranslateSnapshot<T>;
  handleMissingTranslation: <T extends Translation>(
    lookup: TranslateLookup<T>
  ) => void;
  resolveDictionaryEntry: (lookup: DictionaryLookup) => DictionaryEntrySnapshot;
  handleMissingDictionaryEntry: (lookup: DictionaryLookup) => void;
  resolveDictionaryObject: (
    lookup: DictionaryLookup
  ) => DictionaryObjectSnapshot;
  handleMissingDictionaryObject: (lookup: DictionaryLookup) => void;
};

/**
 * @deprecated - dead code
 */
export function useLookupResolver(): LookupResolver {
  const adapter = useLookupAdapter();

  /**
   * Keep synchronous lookup callsites from reaching directly into I18nStore or
   * server snapshots. The adapter still owns SPA/SRA precedence; this hook just
   * wraps the repeated "read store fallback, then resolve" pattern.
   */
  return useMemo(
    () => ({
      resolveTranslation: (lookup) => {
        const storeTranslation = adapter.getTranslationSnapshot(lookup);
        return adapter.resolveTranslation(lookup, storeTranslation);
      },
      handleMissingTranslation: (lookup) => {
        adapter.handleMissingTranslation?.(lookup);
      },
      resolveDictionaryEntry: (lookup) => {
        const storeDictionaryEntry = adapter.getDictionaryEntrySnapshot(lookup);
        return adapter.resolveDictionaryEntry(lookup, storeDictionaryEntry);
      },
      handleMissingDictionaryEntry: (lookup) => {
        adapter.handleMissingDictionaryEntry?.(lookup);
      },
      resolveDictionaryObject: (lookup) => {
        const storeDictionaryObject =
          adapter.getDictionaryObjectSnapshot(lookup);
        return adapter.resolveDictionaryObject(lookup, storeDictionaryObject);
      },
      handleMissingDictionaryObject: (lookup) => {
        adapter.handleMissingDictionaryObject?.(lookup);
      },
    }),
    [adapter]
  );
}
