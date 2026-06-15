import type { LocaleCandidates } from 'gt-i18n/internal';
import { getI18nConfig } from 'gt-i18n/internal';
import {
  BrowserConditionStore,
  BrowserConditionStoreParams,
} from './BrowserConditionStore';
import { readBrowserLocale } from './readBrowserLocale';
import {
  defaultEnableI18nCookieName,
  defaultLocaleCookieName,
} from '../internal';
import { getCookieValue } from './cookies';
import {
  getBrowserConditionStore,
  isBrowserConditionStoreInitialized,
  setBrowserConditionStore,
} from './singleton-operations';

export type CreateBrowserConditionStoreParams = Omit<
  BrowserConditionStoreParams,
  'locale' | 'enableI18n' | 'localeCookieName' | 'enableI18nCookieName'
> & {
  locale?: LocaleCandidates;
  enableI18n?: boolean;
  localeCookieName?: string;
  enableI18nCookieName?: string;
};

/**
 * Factory to create a BrowserConditionStore for Singleton
 *
 * This exists so we can keep the locale param as required in the constructor
 *
 * We want the values that we read from the cookies to override as this
 * persists state across page reloads
 */
export function createOrUpdateBrowserConditionStore(
  config: CreateBrowserConditionStoreParams
) {
  const locale = determineLocale(config);
  const enableI18n = determineEnableI18n(config);

  if (isBrowserConditionStoreInitialized()) {
    // This represents an update from server
    const conditionStore = getBrowserConditionStore();
    conditionStore.updateLocale(locale);
    conditionStore.updateEnableI18n(enableI18n);
    return;
  }

  const conditionStore = new BrowserConditionStore({
    ...config,
    localeCookieName: defaultLocaleCookieName,
    enableI18nCookieName: defaultEnableI18nCookieName,
    locale,
    enableI18n,
  });
  setBrowserConditionStore(conditionStore);
}

function determineLocale({
  localeCookieName = defaultLocaleCookieName,
  _getLocale: getLocale,
  locale,
}: CreateBrowserConditionStoreParams): string {
  const candidates = [];
  candidates.push(...readBrowserLocale(localeCookieName));
  if (locale) candidates.push(...locale);
  if (getLocale) candidates.push(getLocale());
  return resolveLocale(candidates);
}

function resolveLocale(candidates?: LocaleCandidates): string {
  const i18nConfig = getI18nConfig();
  return (
    i18nConfig.determineLocale(candidates) || i18nConfig.getDefaultLocale()
  );
}

function determineEnableI18n({
  enableI18n,
  enableI18nCookieName = defaultEnableI18nCookieName,
  _getEnableI18n: getEnableI18n,
}: CreateBrowserConditionStoreParams): boolean {
  const cookieEnableI18n = getCookieValue({
    cookieName: enableI18nCookieName,
  });
  if (cookieEnableI18n === undefined) {
    return getEnableI18n?.() ?? enableI18n ?? true;
  }
  return cookieEnableI18n === 'true';
}
