import {
  preloadTranslations,
  I18nStore,
  setI18nStore,
  setReactI18nCache,
  getReadonlyConditionStore,
  getI18nConfig,
  initializeI18nConfig,
  setGlobalTranslationsSnapshot,
  loadTranslationsSnapshot,
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
  CreateBrowserConditionStoreParams;

/**
 * Initialize GT for an SPA
 * - conditionStore
 * - translationsSnapshot (production)
 * - i18nCache and i18nStore (development only)
 *
 * This is SPA for browser runtime
 *
 * Call once per page load. The snapshot keeps its first value, so calling
 * this again does not reload translations; changing locale reloads the page.
 * Translations never expire in the browser, so `cacheExpiryTime` is ignored.
 */
export async function initializeGTSPA(config: InitializeGTSPAParams) {
  const runtimeConfig = addRuntimeCredentials(config);
  initializeI18nConfig(runtimeConfig, 'SPA');

  createOrUpdateBrowserConditionStore(runtimeConfig);
  const locale = getReadonlyConditionStore().getLocale();

  // Production lookups read the snapshot, so it skips the cache and store
  if (process.env.NODE_ENV === 'production') {
    setGlobalTranslationsSnapshot(
      await loadTranslationsSnapshot(runtimeConfig, locale)
    );
    return;
  }

  // Dev hot reload reads from and updates the cache through the store
  setReactI18nCache(
    new BrowserI18nCache({
      ...runtimeConfig,
      // Lookups are synchronous, so an expired locale would render untranslated.
      cacheExpiryTime: null,
    })
  );
  setI18nStore(new I18nStore());

  // Block until translations are loaded
  await preloadTranslations(locale);
}
