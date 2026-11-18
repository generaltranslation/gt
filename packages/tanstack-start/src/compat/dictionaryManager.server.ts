import {
  initializeDictionaryManager,
  isDictionaryManagerInitialized,
} from 'gt-i18n/internal/compat';
import { config as pluginConfig } from 'gt-tanstack-start/internal/_config';
import {
  dictionary,
  loadDictionary,
} from 'gt-tanstack-start/internal/_compat-config';
import { getServerConditionStore } from 'gt-tanstack-start/internal/initializeGT.server';

// A Vite dev server restart evaluates the plugin's dictionary loader again, so outside production builds the DictionaryManager is set up once for each evaluation.
let initialized = false;

function isInitialized(): boolean {
  return process.env.NODE_ENV === 'production'
    ? isDictionaryManagerInitialized()
    : initialized;
}

/**
 * Initialize GT, then the DictionaryManager from the Vite plugin's dictionary
 * and dictionary loader, once.
 */
export function ensureDictionaryManager(): void {
  // Initializes GT, or throws the plugin setup error without the plugin.
  getServerConditionStore();
  if (isInitialized()) return;
  initializeDictionaryManager({
    dictionary,
    loadDictionary,
    cacheExpiryTime: pluginConfig?.cacheExpiryTime,
  });
  initialized = true;
}
