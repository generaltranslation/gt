import { WritableConditionStoreParams } from '@generaltranslation/react-core/context';
import { getCookieValue, setCookieValue } from './cookies';
import { readBrowserLocale } from './readBrowserLocale';
import { GetEnableI18n, GetLocale } from '../i18n-cache/types';
import { getI18nConfig } from 'gt-i18n/internal';
import {
  LocaleCandidates,
  WritableConditionStoreInterface,
} from 'gt-i18n/internal/types';

type SerializedBrowserConditionStoreState = {
  locale: string;
  enableI18n: boolean;
};
export type ReloadType = (state: SerializedBrowserConditionStoreState) => void;

/**
 * The configuration for the BrowserConditionStore
 * @param {string[]} locales - The accepted locales
 * @param {CustomMapping} [customMapping] - The custom mapping
 * @param {GetLocale} getLocale - The function to get the locale
 * @param {string} [localeCookieName=defaultLocaleCookieName] - The name of the locale cookie to check
 */
export type BrowserConditionStoreParams = WritableConditionStoreParams & {
  localeCookieName: string;
  enableI18nCookieName: string;
  getLocale?: GetLocale;
  getEnableI18n?: GetEnableI18n;
  reload?: ReloadType;
};

/**
 * Condition store implementation for Browser.
 */
export class BrowserConditionStore implements WritableConditionStoreInterface {
  private localeCookieName: string;
  private enableI18nCookieName: string;
  private customReload: ReloadType;
  private customGetLocale?: GetLocale;
  private customGetEnableI18n?: GetEnableI18n;

  constructor(config: BrowserConditionStoreParams) {
    this.customReload = config.reload ?? (() => window.location.reload());
    this.customGetLocale = config.getLocale;
    this.customGetEnableI18n = config.getEnableI18n;
    this.localeCookieName = config.localeCookieName;
    this.enableI18nCookieName = config.enableI18nCookieName;
    setCookieValue({
      cookieName: this.localeCookieName,
      value: resolveLocale(config.locale),
    });
  }

  getLocale = (): string => {
    return getBrowserLocale(this.localeCookieName, this.customGetLocale);
  };

  setLocale = (locale: LocaleCandidates): void => {
    this.updateLocale(locale);
    this.reload();
  };

  getEnableI18n = (): boolean => {
    const cookieEnableI18n = getCookieValue({
      cookieName: this.enableI18nCookieName,
    });
    if (cookieEnableI18n === undefined) {
      return this.customGetEnableI18n?.() ?? true;
    }
    return cookieEnableI18n === 'true';
  };

  setEnableI18n = (enableI18n: boolean): void => {
    this.updateEnableI18n(enableI18n);
    this.reload();
  };

  /**
   * Soft locale update
   */
  updateLocale = (locale: LocaleCandidates): void => {
    setCookieValue({
      cookieName: this.localeCookieName,
      value: resolveLocale(locale),
    });
  };

  /**
   * Soft enableI18n update
   */
  updateEnableI18n = (enableI18n: boolean): void => {
    setCookieValue({
      cookieName: this.enableI18nCookieName,
      value: enableI18n ? 'true' : 'false',
    });
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

function getBrowserLocale(cookieName: string, getLocale?: GetLocale): string {
  const candidates = readBrowserLocale(cookieName);
  if (getLocale) candidates.push(getLocale());
  return resolveLocale(candidates);
}

function resolveLocale(candidates?: LocaleCandidates): string {
  const i18nConfig = getI18nConfig();
  return (
    i18nConfig.determineLocale(candidates) || i18nConfig.getDefaultLocale()
  );
}
