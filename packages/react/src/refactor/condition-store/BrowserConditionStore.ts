import {
  defaultEnableI18nCookieName,
  defaultLocaleCookieName,
} from "@generaltranslation/react-core/internal";
import {
  getReactI18nManager,
  WritableConditionStore,
  WritableConditionStoreParams,
} from "@generaltranslation/react-core/context";
import { getCookieValue, setCookieValue } from "./cookies";
import { readBrowserLocale } from "./readBrowserLocale";
import { GetLocale } from "../i18n-manager/types";
import { LocaleCandidates } from "gt-i18n/internal/types";

/**
 * The configuration for the BrowserConditionStore
 * @param {string[]} locales - The accepted locales
 * @param {CustomMapping} [customMapping] - The custom mapping
 * @param {GetLocale} getLocale - The function to get the locale
 * @param {string} [localeCookieName=defaultLocaleCookieName] - The name of the locale cookie to check
 */
export type BrowserConditionStoreParams = Omit<
  WritableConditionStoreParams,
  "locale"
> & {
  locale?: string;
  localeCookieName?: string;
  enableI18nCookieName?: string;
  getLocale?: GetLocale;
};

/**
 * Condition store implementation for Browser.
 */
export class BrowserConditionStore extends WritableConditionStore {
  private localeCookieName: string;
  private enableI18nCookieName: string;

  constructor({
    localeCookieName = defaultLocaleCookieName,
    enableI18nCookieName = defaultEnableI18nCookieName,
    ...config
  }: BrowserConditionStoreParams) {
    const locale = getBrowserLocale(localeCookieName, config.getLocale);

    super({
      ...config,
      locale,
    });
    this.localeCookieName = localeCookieName;
    this.enableI18nCookieName = enableI18nCookieName;
  }

  getLocale = (): string => {
    return getBrowserLocale(this.localeCookieName, this.getLocale);
  };

  setLocale = (locale: LocaleCandidates): void => {
    setCookieValue({
      cookieName: this.localeCookieName,
      value: getReactI18nManager().determineLocale(locale),
    });
    window.location.reload();
  };

  getEnableI18n = (): boolean => {
    const cookieEnableI18n = getCookieValue({
      cookieName: this.enableI18nCookieName,
    });
    return cookieEnableI18n === "true" || cookieEnableI18n === undefined;
  };

  setEnableI18n = (enableI18n: boolean): void => {
    setCookieValue({
      cookieName: this.enableI18nCookieName,
      value: enableI18n ? "true" : "false",
    });
  };
}

function getBrowserLocale(cookieName: string, getLocale?: GetLocale): string {
  const candidates = readBrowserLocale(cookieName);
  if (getLocale) candidates.push(getLocale());
  return getReactI18nManager().determineLocale(candidates);
}
