import {
  preloadTranslations,
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
import { addRuntimeCredentials } from 'gt-i18n/internal/credentials';

export type InitializeGTSPAParams = I18nConfigParams &
  BrowserI18nCacheParams &
  CreateBrowserConditionStoreParams;

/**
 * Initialize GT for an SPA
 * - i18nCache
 * - conditionStore
 * - i18nStore
 *
 * This is SPA for browser runtime
 *
 * Translations never expire in the browser, so `cacheExpiryTime` is ignored.
 */
export async function initializeGTSPA(config: InitializeGTSPAParams) {
  const runtimeConfig = addRuntimeCredentials(config, 'gt-react');
  initializeI18nConfig(runtimeConfig, 'SPA');

  const i18nCache = new BrowserI18nCache({
    ...runtimeConfig,
    // Lookups are synchronous, so an expired locale would render untranslated.
    cacheExpiryTime: null,
  });
  setReactI18nCache(i18nCache);

  createOrUpdateBrowserConditionStore(runtimeConfig);

  const i18nStore = new I18nStore();
  setI18nStore(i18nStore);

  // Block until translations are loaded
  await preloadTranslations(getReadonlyConditionStore().getLocale());
}
