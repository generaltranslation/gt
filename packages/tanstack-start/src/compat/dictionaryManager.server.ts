import { initializeDictionaryManager } from 'gt-i18n/internal/compat';
import { config as pluginConfig } from 'gt-tanstack-start/internal/_config';
import {
  dictionary,
  loadDictionary,
  state as compatState,
} from 'gt-tanstack-start/internal/_compat-config';
import { getServerConditionStore } from '../setup/initializeGT.server';

/**
 * Initialize GT, then the DictionaryManager from the Vite plugin's dictionary
 * and dictionary loader, once for each evaluation of the plugin's module.
 */
export function ensureDictionaryManager(): void {
  // Initializes GT, or throws the plugin setup error without the plugin.
  getServerConditionStore();
  if (compatState.initialized) return;
  initializeDictionaryManager({
    dictionary,
    loadDictionary,
    cacheExpiryTime: pluginConfig?.cacheExpiryTime,
  });
  compatState.initialized = true;
}
