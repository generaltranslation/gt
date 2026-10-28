import type { Dictionary } from 'gt-i18n';
import { createGlobalSingleton, type Locale } from 'gt-i18n/internal';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import { createContext, useContext, type Context } from 'react';
import type { CompatStore } from './CompatStore';
import { getCompatStore } from './singleton-operations';
import type { OnMissingDictionaryEntry, OnMissingDictionaryObj } from './types';

export type DictionaryContextType = {
  /**
   * Dictionaries streamed from the server, keyed by locale
   */
  dictionariesSnapshot: Record<Locale, Dictionary>;
  /**
   * CompatStore syncs DictionaryManager updates with renders
   */
  compatStore: CompatStore;
  /**
   * Custom override behavior on missing dictionary entries
   * Used for server triggering dictionary hmr b/c no access to useEffect
   */
  onMissingDictionaryEntry?: OnMissingDictionaryEntry;
  onMissingDictionaryObj?: OnMissingDictionaryObj;
};

const dictionaryContextSingleton = createGlobalSingleton<
  Context<DictionaryContextType | undefined>
>({
  namespace: 'reactCore',
  key: 'dictionaryContext',
  source: '@generaltranslation/react-core',
  notInitialized: () =>
    createDiagnosticMessage({
      source: '@generaltranslation/react-core',
      severity: 'Error',
      whatHappened:
        'Cannot read DictionaryContext before it has been initialized',
    }),
});

export function getDictionaryContext(): Context<
  DictionaryContextType | undefined
> {
  // Lazily create the React context once and share it across instances.
  if (!dictionaryContextSingleton.isInitialized()) {
    dictionaryContextSingleton.set(
      createContext<DictionaryContextType | undefined>(undefined)
    );
  }
  return dictionaryContextSingleton.get();
}

const EMPTY_DICTIONARIES_SNAPSHOT: Record<Locale, Dictionary> = {};

export function useDictionaryContext(): DictionaryContextType {
  const context = useContext(getDictionaryContext());
  // shortcut: R5 compat glue, removed in R6 when GTProvider/initializeGT stop accepting dictionaries
  return (
    context ?? {
      dictionariesSnapshot: EMPTY_DICTIONARIES_SNAPSHOT,
      compatStore: getCompatStore(),
    }
  );
}
