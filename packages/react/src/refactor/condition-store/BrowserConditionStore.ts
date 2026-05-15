import {
  defaultEnableI18nCookieName,
  defaultLocaleCookieName,
} from '@generaltranslation/react-core/internal';
import {
  ReactConditionStore,
  ReactConditionStoreParams,
} from '@generaltranslation/react-core/context';
import { getCookieValue, setCookieValue } from './cookies';
import { readBrowserLocale } from './readBrowserLocale';

/**
 * The configuration for the BrowserConditionStore
 * @param {string[]} locales - The accepted locales
 * @param {CustomMapping} [customMapping] - The custom mapping
 * @param {GetLocale} getLocale - The function to get the locale
 * @param {string} [localeCookieName=defaultLocaleCookieName] - The name of the locale cookie to check
 */
export type BrowserConditionStoreParams = Omit<
  ReactConditionStoreParams,
  'locale'
> & {
  locale?: string;
  localeCookieName?: string;
  enableI18nCookieName?: string;
};

/**
 * Condition store implementation for Browser.
 */
export class BrowserConditionStore extends ReactConditionStore {
  private localeCookieName: string;
  private enableI18nCookieName: string;

  constructor({
    localeCookieName = defaultLocaleCookieName,
    enableI18nCookieName = defaultEnableI18nCookieName,
    ...config
  }: BrowserConditionStoreParams) {
    const locale = config.locale ?? readBrowserLocale(localeCookieName);
    super({
      ...config,
      locale,
    });
    this.localeCookieName = localeCookieName;
    this.enableI18nCookieName = enableI18nCookieName;
  }

  getLocale = (): string => {
    return readBrowserLocale(this.localeCookieName);
  };

  setLocale = (locale: string): void => {
    setCookieValue({
      cookieName: this.localeCookieName,
      value: locale,
    });
    window.location.reload();
  };

  getEnableI18n = (): boolean => {
    const cookieEnableI18n = getCookieValue({
      cookieName: this.enableI18nCookieName,
    });
    return cookieEnableI18n === 'true' || cookieEnableI18n === undefined;
  };

  setEnableI18n = (enableI18n: boolean): void => {
    setCookieValue({
      cookieName: this.enableI18nCookieName,
      value: enableI18n ? 'true' : 'false',
    });
  };
}
