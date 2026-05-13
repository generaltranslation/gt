import {
  defaultEnableI18nCookieName,
  defaultLocaleCookieName,
} from "@generaltranslation/react-core/internal";
import {
  ReactConditionStore,
  ReactConditionStoreParams,
} from "@generaltranslation/react-core/context";
import { getCookieValue, setCookieValue } from "./cookies";

/**
 * The configuration for the BrowserConditionStore
 * @param {string[]} locales - The accepted locales
 * @param {CustomMapping} [customMapping] - The custom mapping
 * @param {GetLocale} getLocale - The function to get the locale
 * @param {string} [localeCookieName=defaultLocaleCookieName] - The name of the locale cookie to check
 */
type BrowserConditionStoreParams = ReactConditionStoreParams & {
  localeCookieName?: string;
  enableI18nCookieName?: string;
};

/**
 * Condition store implementation for Browser.
 */
export class BrowserConditionStore extends ReactConditionStore {
  private localeCookieName: string;
  private enableI18nCookieName: string;

  constructor(config: BrowserConditionStoreParams) {
    super(config);
    this.localeCookieName = config.localeCookieName || defaultLocaleCookieName;
    this.enableI18nCookieName =
      config.enableI18nCookieName || defaultEnableI18nCookieName;
  }

  getLocale = (): string => {
    const candidates = [];

    // (1) Check cookie
    const cookieLocale = getCookieValue({
      cookieName: this.localeCookieName,
    });
    if (cookieLocale) candidates.push(cookieLocale);

    // (2) Check navigator locales
    const navigatorLocales = navigator?.languages || [];
    candidates.push(...navigatorLocales);

    return this.resolveLocale(candidates);
  };

  setLocale = (locale: string): void => {
    setCookieValue({
      cookieName: this.localeCookieName,
      value: locale,
    });
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
