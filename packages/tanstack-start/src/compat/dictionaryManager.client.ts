import {
  initializeDictionaryManager,
  isDictionaryManagerInitialized,
} from 'gt-i18n/internal';
import { config as pluginConfig } from 'gt-tanstack-start/internal/_config';
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
    // Like the browser translation cache, loaded dictionaries do not expire.
    cacheExpiryTime: pluginConfig?.cacheExpiryTime ?? null,
  });
}
