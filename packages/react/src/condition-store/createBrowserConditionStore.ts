import type { I18nConfig, LocaleCandidates } from 'gt-i18n/internal';
import { getI18nConfig } from 'gt-i18n/internal';
import {
  BrowserConditionStore,
  BrowserConditionStoreParams,
} from './BrowserConditionStore';
import { readBrowserLocale } from './readBrowserLocale';
import { getCookieValue } from './cookies';
import {
  getBrowserConditionStore,
  isBrowserConditionStoreInitialized,
  setBrowserConditionStore,
} from './singleton-operations';

export type CreateBrowserConditionStoreParams = Omit<
  BrowserConditionStoreParams,
  | 'locale'
  | 'enableI18n'
  | 'localeCookieName'
  | 'regionCookieName'
  | 'enableI18nCookieName'
> & {
  locale?: LocaleCandidates;
  enableI18n?: boolean;
  localeCookieName?: string;
  regionCookieName?: string;
  enableI18nCookieName?: string;
};

/**
 * Factory to create a BrowserConditionStore for Singleton
 *
 * This exists so we can keep the locale param as required in the constructor
 *
 * We want the values that we read from the cookies to override as this
 * persists state across page reloads
 *
 * Cookie names fall back to the I18nConfig singleton so custom names passed
 * to initializeGT() apply here without being threaded through provider props
 */
export function createOrUpdateBrowserConditionStore(
  config: CreateBrowserConditionStoreParams
) {
  const i18nConfig = getI18nConfig();
  const localeCookieName =
    config.localeCookieName ?? i18nConfig.getLocaleCookieName();
  const regionCookieName =
    config.regionCookieName ?? i18nConfig.getRegionCookieName();
  const enableI18nCookieName =
    config.enableI18nCookieName ?? i18nConfig.getEnableI18nCookieName();

  const locale = determineLocale(config, localeCookieName, i18nConfig);
  const region = determineRegion(config, regionCookieName);
  const enableI18n = determineEnableI18n(config, enableI18nCookieName);

  if (isBrowserConditionStoreInitialized()) {
    // This represents an update from server
    const conditionStore = getBrowserConditionStore();
    conditionStore.updateLocale(locale);
    if (region !== undefined) conditionStore.updateRegion(region);
    conditionStore.updateEnableI18n(enableI18n);
    return conditionStore;
  }

  const conditionStore = new BrowserConditionStore({
    ...config,
    localeCookieName,
    regionCookieName,
    enableI18nCookieName,
    locale,
    region,
    enableI18n,
  });
  setBrowserConditionStore(conditionStore);
  return conditionStore;
}

function determineLocale(
  { _getLocale: getLocale, locale }: CreateBrowserConditionStoreParams,
  localeCookieName: string,
  i18nConfig: I18nConfig
): string {
  const candidates = [];
  if (locale) {
    candidates.push(...(Array.isArray(locale) ? locale : [locale]));
  }
  if (getLocale) candidates.push(getLocale());
  candidates.push(...readBrowserLocale(localeCookieName));
  return i18nConfig.resolveSupportedLocale(candidates);
}

function determineRegion(
  { _getRegion: getRegion, region }: CreateBrowserConditionStoreParams,
  regionCookieName: string
): string | undefined {
  const cookieRegion = getCookieValue({
    cookieName: regionCookieName,
  });
  return cookieRegion || getRegion?.() || region;
}

function determineEnableI18n(
  {
    enableI18n,
    _getEnableI18n: getEnableI18n,
  }: CreateBrowserConditionStoreParams,
  enableI18nCookieName: string
): boolean {
  const cookieEnableI18n = getCookieValue({
    cookieName: enableI18nCookieName,
  });
  if (cookieEnableI18n === undefined) {
    return getEnableI18n?.() ?? enableI18n ?? true;
  }
  return cookieEnableI18n === 'true';
}
