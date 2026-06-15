import { WritableConditionStoreParams } from 'gt-i18n/internal';
import { setCookieValue } from './cookies';
import { GetEnableI18n, GetLocale } from '../i18n-cache/types';
import { getI18nConfig } from 'gt-i18n/internal';
import {
  LocaleCandidates,
  ReadonlyConditionStoreInterface,
} from 'gt-i18n/internal/types';
import {
  defaultEnableI18nCookieName,
  defaultLocaleCookieName,
  defaultResetLocaleCookieName,
} from '../cookie-names';

type SerializedBrowserConditionStoreState = {
  locale: string;
  enableI18n: boolean;
};
export type ReloadType = (state: SerializedBrowserConditionStoreState) => void;

/**
 * The configuration for the BrowserConditionStore
 * @param {GetLocale} getLocale - The function to get the locale
 * @param {string} [localeCookieName=defaultLocaleCookieName] - The name of the locale cookie to check
 */
export type BrowserConditionStoreParams = WritableConditionStoreParams & {
  localeCookieName?: string;
  enableI18nCookieName?: string;
  _getLocale?: GetLocale;
  _getEnableI18n?: GetEnableI18n;
  _reload?: ReloadType;
};

/**
 * Separate from BrowserConditionStore. This is for SSR.
 * For SSR we write to cookie, but never reads from it, and
 * that allows faster getLocale() lookups b/c it reads from
 * memory instead of cookie
 */
export class BrowserConditionStore implements ReadonlyConditionStoreInterface {
  private locale: string;
  private enableI18n: boolean;
  private localeCookieName: string;
  private enableI18nCookieName: string;
  private customReload: ReloadType;
  private customGetLocale?: GetLocale;
  private customGetEnableI18n?: GetEnableI18n;

  constructor(config: BrowserConditionStoreParams) {
    this.customReload =
      config._reload ??
      (() =>
        typeof window !== 'undefined' ? window.location.reload() : undefined);
    this.customGetLocale = config._getLocale;
    this.customGetEnableI18n = config._getEnableI18n;

    // Initialize cookie names
    this.localeCookieName = config.localeCookieName ?? defaultLocaleCookieName;
    this.enableI18nCookieName =
      config.enableI18nCookieName ?? defaultEnableI18nCookieName;

    // Initialize locale and enableI18n from config
    const i18nConfig = getI18nConfig();
    this.locale =
      i18nConfig.determineLocale(config.locale) ||
      i18nConfig.getDefaultLocale();
    this.enableI18n = config.enableI18n ?? true;
    setCookieValue({
      cookieName: this.localeCookieName,
      value: this.locale,
    });
    setCookieValue({
      cookieName: this.enableI18nCookieName,
      value: this.enableI18n ? 'true' : 'false',
    });
  }

  getLocale = (): string => {
    if (this.customGetLocale) {
      return this.customGetLocale();
    }
    return this.locale;
  };

  setLocale = (locale: LocaleCandidates): void => {
    const i18nConfig = getI18nConfig();
    const newLocale =
      i18nConfig.determineLocale(locale) || i18nConfig.getDefaultLocale();
    setCookieValue({
      cookieName: this.localeCookieName,
      value: newLocale,
    });
    setCookieValue({
      cookieName: defaultResetLocaleCookieName,
      value: 'true',
    });
    this.reload();
  };

  getEnableI18n = (): boolean => {
    if (this.customGetEnableI18n) {
      return this.customGetEnableI18n();
    }
    return this.enableI18n;
  };

  setEnableI18n = (enableI18n: boolean): void => {
    this.enableI18n = enableI18n ?? true;
    setCookieValue({
      cookieName: this.enableI18nCookieName,
      value: enableI18n ? 'true' : 'false',
    });
    this.reload();
  };

  /**
   * Condition store updates come from either the server or the client.
   * Trigger this reload when we update a value in the condition store from
   * the client.
   */
  reload = (): void => {
    const state = {
      locale: this.getLocale(),
      enableI18n: this.getEnableI18n(),
    };
    this.customReload(state);
  };
}
