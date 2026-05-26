import { setAsyncConditionStore } from '../async-i18n-cache/singleton-operations';
import type { InitializeGTParams } from './types';
import { I18nCache, setI18nCache } from 'gt-i18n/internal';
import { AsyncConditionStore } from '../async-i18n-cache/AsyncConditionStore';

/**
 * Configure GT for node runtime. This must be called to setup GT for node runtime.
 * @param {InitializeGTParams} config - The configuration for the GT instance
 * TODO: auto detect if can find gt.config.json files
 */
export function initializeGT(params: InitializeGTParams): void {
  const i18nCache = new I18nCache<string>(params);
  const conditionStore = new AsyncConditionStore({
    defaultLocale: i18nCache.getDefaultLocale(),
    locales: i18nCache.getLocales(),
    customMapping: i18nCache.getCustomMapping(),
  });

  setI18nCache(i18nCache);
  setAsyncConditionStore(conditionStore);
}
