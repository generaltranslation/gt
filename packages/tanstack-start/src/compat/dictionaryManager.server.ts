import {
  initializeDictionaryManager,
  isDictionaryManagerInitialized,
} from 'gt-i18n/internal';
import { config as pluginConfig } from 'gt-tanstack-start/internal/_config';
import {
  dictionary,
  loadDictionary,
} from 'gt-tanstack-start/internal/_compat-config';
import { getServerConditionStore } from '../setup/initializeGT.server';

/**
 * Initialize GT, then the DictionaryManager from the Vite plugin's dictionary
 * and dictionary loader, once.
 */
export function ensureDictionaryManager(): void {
  // Initializes GT, or throws the plugin setup error without the plugin.
  getServerConditionStore();
  if (isDictionaryManagerInitialized()) return;
  initializeDictionaryManager({
    dictionary,
    loadDictionary,
    cacheExpiryTime: pluginConfig?.cacheExpiryTime,
  });
}
