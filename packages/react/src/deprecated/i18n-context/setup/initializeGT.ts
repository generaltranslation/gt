import { setI18nCache } from 'gt-i18n/internal';
import type { InitializeGTParams } from './types';
import { BrowserConditionStore } from '../browser-i18n-cache/BrowserConditionStore';
import { BrowserI18nCache } from '../browser-i18n-cache/BrowserI18nCache';
import { setBrowserConditionStore } from '../browser-i18n-cache/singleton-operations';

/**
 * Configure GT for browser runtime. This must be called to setup GT for browser runtime.
 * @param {InitializeGTParams} config - The configuration for the GT instance
 */
export function initializeGT(params: InitializeGTParams): void {
  const i18nCache = new BrowserI18nCache(params);
  const conditionStore = new BrowserConditionStore({
    defaultLocale: i18nCache.getDefaultLocale(),
    locales: i18nCache.getLocales(),
    customMapping: i18nCache.getCustomMapping(),
    getLocale: params.getLocale,
  });

  setI18nCache(i18nCache);
  setBrowserConditionStore(conditionStore);
}
