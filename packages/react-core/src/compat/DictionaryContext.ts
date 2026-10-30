import {
  createGlobalSingleton,
  type Locale,
  type Dictionary,
} from 'gt-i18n/internal';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import { createContext, useContext, type Context } from 'react';
import type { CompatStore } from './CompatStore';
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

const missingDictionaryProviderError = createDiagnosticMessage({
  source: '@generaltranslation/react-core',
  severity: 'Error',
  whatHappened: 'useTranslations() was called outside <GTDictionaryProvider>',
  why: 'the dictionary API reads its dictionaries and store from <GTDictionaryProvider>',
  fix: "Wrap the tree in <GTDictionaryProvider> from your GT package's /compat entry, such as 'gt-react/compat', 'gt-next/compat' or 'gt-react-native/compat'. In gt-tanstack-start, call setupRouterGTDictionaryIntegration({ router }) from 'gt-tanstack-start/compat'",
});

export function useDictionaryContext(): DictionaryContextType {
  const context = useContext(getDictionaryContext());
  if (!context) throw new Error(missingDictionaryProviderError);
  return context;
}
