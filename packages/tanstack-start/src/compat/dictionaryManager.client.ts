import { getI18nCache } from 'gt-i18n/internal';
import {
  initializeDictionaryManager,
  isDictionaryManagerInitialized,
} from 'gt-i18n/internal/compat';
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
  initializeDictionaryManager({
    dictionary,
    loadDictionary,
    // Dictionaries expire with the translations cache set up at
    // initialization, which never expires in the browser unless configured.
    cacheExpiryTime: getI18nCache().getCacheExpiryTime(),
  });
}
