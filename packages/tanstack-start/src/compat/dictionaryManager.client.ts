import {
  getGlobalTranslationsSnapshot,
  getI18nConfig,
  initializeReactI18nCache,
  isGlobalTranslationsSnapshotInitialized,
  getReactI18nCache,
} from '@generaltranslation/react-core/pure';
import {
  initializeDictionaryManager,
  isDictionaryManagerInitialized,
} from 'gt-i18n/internal/compat';
import {
  config as pluginConfig,
  loadTranslations as pluginLoadTranslations,
} from 'gt-tanstack-start/internal/_config';
import {
  dictionary,
  loadDictionary,
} from 'gt-tanstack-start/internal/_compat-config';

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
    ...pluginConfig,
    loadTranslations: pluginLoadTranslations,
    projectId: getI18nConfig().getProjectId(),
    cacheExpiryTime: null,
  });
  // Seeded so dictionary lookups skip reloading the page's translations.
  if (isGlobalTranslationsSnapshotInitialized()) {
    getReactI18nCache().updateTranslations(getGlobalTranslationsSnapshot());
  }
}
