import { initializeReactI18nCache } from '@generaltranslation/react-core/pure';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import {
  initializeDictionaryManager,
  isDictionaryManagerInitialized,
} from 'gt-i18n/internal/compat';
import {
  dictionary,
  loadDictionary,
} from 'gt-tanstack-start/internal/_compat-config';
import { loadClientTranslations } from '../setup/translations.client';

/**
 * Initialize the DictionaryManager from the Vite plugin's dictionary and
 * dictionary loader, once. Like the native browser functions, it relies on
 * setupRouterGTIntegration() having initialized GT.
 */
export function ensureDictionaryManager(): void {
  if (isDictionaryManagerInitialized()) return;
  // Dictionary lookups read the i18nCache, which the native client creates
  // only in development.
  if (process.env.NODE_ENV === 'production') initializeCompatI18nCache();
  initializeDictionaryManager({
    dictionary,
    loadDictionary,
    // Translations never expire in the browser.
    cacheExpiryTime: null,
  });
}

function initializeCompatI18nCache(): void {
  initializeReactI18nCache({
    // Shares the snapshot's loads, so each catalog loads once.
    loadTranslations: async (locale) => {
      const translations = (await loadClientTranslations(locale))[locale];
      if (!translations) throw new Error(createSnapshotLoadError(locale));
      return translations;
    },
    cacheExpiryTime: null,
  });
}

const createSnapshotLoadError = (locale: string) =>
  createDiagnosticMessage({
    source: 'gt-tanstack-start',
    severity: 'Error',
    whatHappened: `Translations for locale "${locale}" did not load`,
  });
