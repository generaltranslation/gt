import {
  getTranslationsSnapshot,
  setReactI18nCache,
  getReadonlyConditionStore,
  initializeI18nConfig,
  createResolveMissing,
} from '@generaltranslation/react-core/pure';
import type { I18nConfigParams } from '@generaltranslation/react-core/pure';
import { BrowserI18nCache } from '../i18n-cache/BrowserI18nCache';
import type { BrowserI18nCacheParams } from '../i18n-cache/BrowserI18nCache';
import {
  createOrUpdateBrowserConditionStore,
  CreateBrowserConditionStoreParams,
} from '../condition-store/createBrowserConditionStore';
import { addRuntimeCredentials } from './runtimeCredentials';
import { createGTMissingTranslationResolver } from 'gt-i18n/internal';

export type InitializeGTSPAParams = I18nConfigParams &
  BrowserI18nCacheParams &
  CreateBrowserConditionStoreParams;

/**
 * Initialize GT for an SPA
 * - i18nCache
 * - conditionStore
 *
 * This is SPA for browser runtime
 */
export async function initializeGTSPA(config: InitializeGTSPAParams) {
  const runtimeConfig = addRuntimeCredentials(config);
  initializeI18nConfig(runtimeConfig, 'SPA');

  const i18nCache = new BrowserI18nCache(runtimeConfig, {
    createMissingTranslationResolver:
      createGTMissingTranslationResolver(runtimeConfig),
    createResolveMissing,
  });
  setReactI18nCache(i18nCache);

  createOrUpdateBrowserConditionStore(runtimeConfig);

  // Block until translations are loaded
  await getTranslationsSnapshot(getReadonlyConditionStore().getLocale());
}
