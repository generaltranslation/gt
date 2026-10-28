import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import type { Dictionary } from 'gt-i18n';
import type { Locale } from 'gt-i18n/internal';
import { CompatStore } from './CompatStore';
import { getDictionaryContext } from './DictionaryContext';
import type { OnMissingDictionaryEntry, OnMissingDictionaryObj } from './types';

export type DictionaryProviderProps = {
  children?: ReactNode;
  // For streaming dictionaries from the server
  dictionaries?: Record<Locale, Dictionary>;
  // Defaults to a store owned by this provider
  compatStore?: CompatStore;
  // Custom override missing dictionary behavior for dev hot reload
  onMissingDictionaryEntry?: OnMissingDictionaryEntry;
  onMissingDictionaryObj?: OnMissingDictionaryObj;
};

const DictionaryContext = getDictionaryContext();
const EMPTY_DICTIONARIES: Record<Locale, Dictionary> = {};

/**
 * Shared dictionary provider logic for the key-based (compat) API. Not
 * user-facing: runtime packages wrap it with their own loading.
 */
export function DictionaryProvider({
  children,
  dictionaries = EMPTY_DICTIONARIES,
  compatStore: compatStoreProp,
  onMissingDictionaryEntry,
  onMissingDictionaryObj,
}: DictionaryProviderProps) {
  const ownStoreRef = useRef<CompatStore | null>(null);
  if (compatStoreProp == null && ownStoreRef.current == null) {
    ownStoreRef.current = new CompatStore();
  }
  const compatStore = compatStoreProp ?? ownStoreRef.current!;

  const value = useMemo(
    () => ({
      dictionariesSnapshot: dictionaries,
      compatStore,
      onMissingDictionaryEntry,
      onMissingDictionaryObj,
    }),
    [
      dictionaries,
      compatStore,
      onMissingDictionaryEntry,
      onMissingDictionaryObj,
    ]
  );

  // Update the dictionary manager with data from the server, do not emit events
  useEffect(() => {
    compatStore.updateDictionaries(dictionaries);
  }, [dictionaries, compatStore]);

  return (
    <DictionaryContext.Provider value={value}>
      {children}
    </DictionaryContext.Provider>
  );
}
