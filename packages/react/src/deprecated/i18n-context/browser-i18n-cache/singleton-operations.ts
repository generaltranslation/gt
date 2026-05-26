import { BROWSER_I18N_CACHE_NOT_INITIALIZED_ERROR } from '../../shared/messages';
import { BrowserI18nCache } from './BrowserI18nCache';
import type { BrowserConditionStore } from './BrowserConditionStore';
import { createConditionStoreSingleton, getI18nCache } from 'gt-i18n/internal';

export const {
  getConditionStore: getBrowserConditionStore,
  setConditionStore: setBrowserConditionStore,
} = createConditionStoreSingleton<BrowserConditionStore>(
  BROWSER_I18N_CACHE_NOT_INITIALIZED_ERROR
);

/**
 * Singleton instance of BrowserI18nCache
 * @returns The singleton instance of BrowserI18nCache
 */
export function getBrowserI18nCache(): BrowserI18nCache {
  const i18nCache = getI18nCache();
  if (!(i18nCache instanceof BrowserI18nCache)) {
    throw new Error(BROWSER_I18N_CACHE_NOT_INITIALIZED_ERROR);
  }
  return i18nCache;
}

/** @deprecated use getBrowserI18nCache instead */
export { getBrowserI18nCache as getBrowserI18nManager };
