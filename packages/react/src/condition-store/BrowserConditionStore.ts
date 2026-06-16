import { WritableConditionStoreParams } from 'gt-i18n/internal';
import { getCookieValue, setCookieValue } from './cookies';
import { readBrowserLocale } from './readBrowserLocale';
import { GetEnableI18n, GetLocale, GetRegion } from '../i18n-cache/types';
import { getI18nConfig } from 'gt-i18n/internal';
import {
  LocaleCandidates,
  WritableConditionStoreInterface,
} from 'gt-i18n/internal/types';
import {
  defaultEnableI18nCookieName,
  defaultLocaleCookieName,
  defaultRegionCookieName,
} from '../cookie-names';

type SerializedBrowserConditionStoreState = {
  locale: string;
  region: string | undefined;
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
  regionCookieName?: string;
  enableI18nCookieName?: string;
  _getLocale?: GetLocale;
  _getRegion?: GetRegion;
  _getEnableI18n?: GetEnableI18n;
  _reload?: ReloadType;
};

/**
 * Condition store implementation for Browser.
 */
export class BrowserConditionStore implements WritableConditionStoreInterface {
  private localeCookieName: string;
  private regionCookieName: string;
  private enableI18nCookieName: string;
  private customReload: ReloadType;
  private customGetLocale?: GetLocale;
  private customGetRegion?: GetRegion;
  private customGetEnableI18n?: GetEnableI18n;

  constructor(config: BrowserConditionStoreParams) {
    this.customReload =
      config._reload ??
      (() =>
        typeof window !== 'undefined' ? window.location.reload() : undefined);
    this.customGetLocale = config._getLocale;
    this.customGetRegion = config._getRegion;
    this.customGetEnableI18n = config._getEnableI18n;
    this.localeCookieName = config.localeCookieName ?? defaultLocaleCookieName;
    this.regionCookieName = config.regionCookieName ?? defaultRegionCookieName;
    this.enableI18nCookieName =
      config.enableI18nCookieName ?? defaultEnableI18nCookieName;
    const i18nConfig = getI18nConfig();
    setCookieValue({
      cookieName: this.localeCookieName,
      value:
        i18nConfig.determineLocale(config.locale) ||
        i18nConfig.getDefaultLocale(),
    });
    if (config.region !== undefined) {
      setCookieValue({
        cookieName: this.regionCookieName,
        value: config.region,
      });
    }
  }

  getLocale = (): string => {
    return getBrowserLocale(this.localeCookieName, this.customGetLocale);
  };

  setLocale = (locale: LocaleCandidates): void => {
    this.updateLocale(locale);
    this.reload();
  };

  getRegion = (): string | undefined => {
    const cookieRegion = getCookieValue({
      cookieName: this.regionCookieName,
    });
    if (cookieRegion) return cookieRegion;
    return this.customGetRegion?.();
  };

  setRegion = (region: string | undefined): void => {
    this.updateRegion(region);
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
    const i18nConfig = getI18nConfig();
    setCookieValue({
      cookieName: this.localeCookieName,
      value:
        i18nConfig.determineLocale(locale) || i18nConfig.getDefaultLocale(),
    });
  };

  /**
   * Soft region update
   */
  updateRegion = (region: string | undefined): void => {
    setCookieValue({
      cookieName: this.regionCookieName,
      value: region ?? '',
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
      region: this.getRegion(),
      enableI18n: this.getEnableI18n(),
    };
    this.customReload(state);
  };
}

function getBrowserLocale(cookieName: string, getLocale?: GetLocale): string {
  const candidates = readBrowserLocale(cookieName);
  if (getLocale) candidates.push(getLocale());
  const i18nConfig = getI18nConfig();
  return (
    i18nConfig.determineLocale(candidates) || i18nConfig.getDefaultLocale()
  );
}
