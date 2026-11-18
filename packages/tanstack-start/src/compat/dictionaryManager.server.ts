import { initializeDictionaryManager } from 'gt-i18n/internal/compat';
import { config as pluginConfig } from 'gt-tanstack-start/internal/_config';
import {
  dictionary,
  loadDictionary,
} from 'gt-tanstack-start/internal/_compat-config';
import { getServerConditionStore } from 'gt-tanstack-start/internal/initializeGT.server';

// Module state, so a Vite dev server restart sets the DictionaryManager up again with the new loader.
let initialized = false;

/**
 * Initialize GT, then the DictionaryManager from the Vite plugin's dictionary
 * and dictionary loader, once.
 */
export function ensureDictionaryManager(): void {
  // Initializes GT, or throws the plugin setup error without the plugin.
  getServerConditionStore();
  if (initialized) return;
  initializeDictionaryManager({
    dictionary,
    loadDictionary,
    cacheExpiryTime: pluginConfig?.cacheExpiryTime,
  });
  initialized = true;
}
