import { getReactI18nManager } from '@generaltranslation/react-core/context';
import type { LocaleCandidates } from 'gt-i18n/internal';
import {
  BrowserConditionStore,
  BrowserConditionStoreParams,
} from './BrowserConditionStore';
import { readBrowserLocale } from './readBrowserLocale';
import {
  defaultEnableI18nCookieName,
  defaultLocaleCookieName,
} from '@generaltranslation/react-core/internal';
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
 * Factory to create a BrowserConditionStore
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
    const conditionStore = getBrowserConditionStore();
    conditionStore.updateLocale(locale);
    conditionStore.updateEnableI18n(enableI18n);
    return;
  }
  const conditionStore = new BrowserConditionStore({
    ...config,
    localeCookieName: defaultLocaleCookieName,
    enableI18nCookieName: defaultEnableI18nCookieName,
    locale: determineLocale(config),
    enableI18n: determineEnableI18n(config),
  });
  setBrowserConditionStore(conditionStore);
}

function determineLocale({
  localeCookieName = defaultLocaleCookieName,
  getLocale,
  locale,
}: CreateBrowserConditionStoreParams): string {
  const candidates = [];
  candidates.push(...readBrowserLocale(localeCookieName));
  if (locale) candidates.push(...locale);
  if (getLocale) candidates.push(getLocale());
  return getReactI18nManager().determineLocale(candidates);
}

function determineEnableI18n({
  enableI18n,
  enableI18nCookieName = defaultEnableI18nCookieName,
  getEnableI18n,
}: CreateBrowserConditionStoreParams): boolean {
  const cookieEnableI18n = getCookieValue({
    cookieName: enableI18nCookieName,
  });
  if (cookieEnableI18n === undefined) {
    return getEnableI18n?.() ?? enableI18n ?? true;
  }
  return cookieEnableI18n === 'true';
}
