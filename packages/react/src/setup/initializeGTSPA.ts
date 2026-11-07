import {
  initializeDictionaryManager,
  type DictionaryConfig,
} from 'gt-i18n/internal';
import {
  getTranslationsSnapshot,
  I18nStore,
  setI18nStore,
  setReactI18nCache,
  getReadonlyConditionStore,
  initializeI18nConfig,
} from '@generaltranslation/react-core/pure';
import type { I18nConfigParams } from '@generaltranslation/react-core/pure';
import { BrowserI18nCache } from '../i18n-cache/BrowserI18nCache';
import type { BrowserI18nCacheParams } from '../i18n-cache/BrowserI18nCache';
import {
  createOrUpdateBrowserConditionStore,
  CreateBrowserConditionStoreParams,
} from '../condition-store/createBrowserConditionStore';
import { addRuntimeCredentials } from './runtimeCredentials';

export type InitializeGTSPAParams = I18nConfigParams &
  BrowserI18nCacheParams &
  CreateBrowserConditionStoreParams &
  // shortcut: R5 compat glue, removed in R6 when GTProvider/initializeGT stop accepting dictionaries
  DictionaryConfig;

/**
 * Initialize GT for an SPA
 * - i18nCache
 * - conditionStore
 * - i18nStore
 *
 * This is SPA for browser runtime
 */
export async function initializeGTSPA({
  dictionary,
  loadDictionary,
  ...config
}: InitializeGTSPAParams) {
  const runtimeConfig = addRuntimeCredentials(config);
  initializeI18nConfig(runtimeConfig, 'SPA');

  const i18nCache = new BrowserI18nCache(runtimeConfig);
  setReactI18nCache(i18nCache);
  // shortcut: R5 compat glue, removed in R6 when GTProvider/initializeGT stop accepting dictionaries
  initializeDictionaryManager({
    dictionary,
    loadDictionary,
    cacheExpiryTime: runtimeConfig.cacheExpiryTime,
  });

  createOrUpdateBrowserConditionStore(runtimeConfig);

  const i18nStore = new I18nStore();
  setI18nStore(i18nStore);

  // Block until translations are loaded
  await getTranslationsSnapshot(getReadonlyConditionStore().getLocale());
}
