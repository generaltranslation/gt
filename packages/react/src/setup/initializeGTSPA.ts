import {
  getTranslationsSnapshot,
  I18nStore,
  setI18nStore,
  setReactI18nCache,
  getReadonlyConditionStoreWithFallback,
  initializeI18nConfig,
} from '@generaltranslation/react-core/pure';
import type { I18nConfigParams } from '@generaltranslation/react-core/pure';
import { setupGTServicesEnabled } from 'gt-i18n/internal';
import type { GTServicesEnabledParams } from 'gt-i18n/internal/types';
import { BrowserI18nCache } from '../i18n-cache/BrowserI18nCache';
import type { BrowserI18nCacheParams } from '../i18n-cache/BrowserI18nCache';
import {
  createOrUpdateBrowserConditionStore,
  CreateBrowserConditionStoreParams,
} from '../condition-store/createBrowserConditionStore';

/**
 * Initialize GT for an SPA
 * - i18nCache
 * - conditionStore
 * - i18nStore
 *
 * This is SPA for browser runtime
 */
export async function initializeGTSPA(
  config: I18nConfigParams &
    GTServicesEnabledParams &
    BrowserI18nCacheParams &
    CreateBrowserConditionStoreParams
) {
  setupGTServicesEnabled(config);
  initializeI18nConfig(config, 'SPA');

  const i18nCache = new BrowserI18nCache(config);
  setReactI18nCache(i18nCache);

  createOrUpdateBrowserConditionStore(config);

  const i18nStore = new I18nStore();
  setI18nStore(i18nStore);

  // Block until translations are loaded
  await getTranslationsSnapshot(
    getReadonlyConditionStoreWithFallback().getLocale()
  );
}
