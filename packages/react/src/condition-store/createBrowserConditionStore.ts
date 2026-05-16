import { getI18nManager, LocaleCandidates } from "gt-i18n/internal";
import {
  BrowserConditionStore,
  BrowserConditionStoreParams,
} from "./BrowserConditionStore";
import { readBrowserLocale } from "./readBrowserLocale";
import {
  defaultEnableI18nCookieName,
  defaultLocaleCookieName,
} from "@generaltranslation/react-core/internal";
import { getCookieValue } from "./cookies";

export type CreateBrowserConditionStoreParams = Omit<
  BrowserConditionStoreParams,
  "locale" | "enableI18n" | "localeCookieName" | "enableI18nCookieName"
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
export function createBrowserConditionStore(
  config: CreateBrowserConditionStoreParams,
): BrowserConditionStore {
  return new BrowserConditionStore({
    ...config,
    localeCookieName: defaultLocaleCookieName,
    enableI18nCookieName: defaultEnableI18nCookieName,
    locale: determineLocale(config),
    enableI18n: determineEnableI18n(config),
  });
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
  return getI18nManager().determineLocale(candidates);
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
  return cookieEnableI18n === "true";
}
