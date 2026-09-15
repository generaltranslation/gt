import {
  getTranslationsSnapshot,
  setReactI18nCache,
  getReadonlyConditionStore,
  initializeI18nConfig,
  I18nStore,
  setI18nStore,
} from '@generaltranslation/react-core/pure';
import { createClientI18nRuntime, setI18nRuntime } from 'gt-i18n/internal';
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
 * - condition store in every environment
 * - shared i18n runtime in every environment
 * - cache and external store in development only
 *
 * This is SPA for browser runtime
 */
export async function initializeGTSPA(config: InitializeGTSPAParams) {
  const runtimeConfig = addRuntimeCredentials(config);
  initializeI18nConfig(runtimeConfig, 'SPA');

  createOrUpdateBrowserConditionStore(runtimeConfig);
  const locale = getReadonlyConditionStore().getLocale();

  if (process.env.NODE_ENV === 'production') {
    setI18nRuntime(createClientI18nRuntime(runtimeConfig));
  } else {
    const i18nCache = new BrowserI18nCache(runtimeConfig);
    setReactI18nCache(i18nCache);
    setI18nStore(new I18nStore());
  }
  await getTranslationsSnapshot(locale);
}
