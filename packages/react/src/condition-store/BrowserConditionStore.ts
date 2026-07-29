import {
  defaultResetLocaleCookieName,
  getI18nConfig,
} from '@generaltranslation/react-core/pure';
import type { WritableConditionStoreParams } from 'gt-i18n/internal';
import { getCookieValue, setCookieValue, type CookieOptions } from './cookies';
import { readBrowserLocale } from './readBrowserLocale';
import { GetEnableI18n, GetLocale, GetRegion } from '../i18n-cache/types';
import {
  LocaleCandidates,
  WritableConditionStoreInterface,
} from 'gt-i18n/internal/types';

type SerializedBrowserConditionStoreState = {
  locale: string;
  region: string | undefined;
  enableI18n: boolean;
};
export type ReloadType = (state: SerializedBrowserConditionStoreState) => void;

/**
 * The configuration for the BrowserConditionStore
 * @param {GetLocale} getLocale - The function to get the locale
 */
export type BrowserConditionStoreParams = WritableConditionStoreParams & {
  _getLocale?: GetLocale;
  _getRegion?: GetRegion;
  _getEnableI18n?: GetEnableI18n;
  _reload?: ReloadType;
  /** @internal Override locale persistence for framework integrations. */
  _localeCookieName?: string;
  /** @internal Override locale cookie attributes for framework integrations. */
  _localeCookieOptions?: CookieOptions;
  /** @internal Disable the GT middleware reset signal for framework routing. */
  _resetLocaleCookie?: boolean;
};

/**
 * Condition store implementation for Browser.
 */
export class BrowserConditionStore implements WritableConditionStoreInterface {
  private customReload: ReloadType;
  private customGetLocale?: GetLocale;
  private customGetRegion?: GetRegion;
  private customGetEnableI18n?: GetEnableI18n;
  private localeCookieName: string;
  private localeCookieOptions?: CookieOptions;
  private resetLocaleCookie: boolean;

  constructor(config: BrowserConditionStoreParams) {
    const i18nConfig = getI18nConfig();
    this.customReload =
      config._reload ??
      (() =>
        typeof window !== 'undefined' ? window.location.reload() : undefined);
    this.customGetLocale = config._getLocale;
    this.customGetRegion = config._getRegion;
    this.customGetEnableI18n = config._getEnableI18n;
    this.localeCookieName =
      config._localeCookieName ?? i18nConfig.getLocaleCookieName();
    this.localeCookieOptions = config._localeCookieOptions;
    this.resetLocaleCookie = config._resetLocaleCookie ?? true;
    setCookieValue({
      cookieName: this.localeCookieName,
      value: i18nConfig.resolveSupportedLocale(config.locale),
      ...(this.localeCookieOptions && {
        options: this.localeCookieOptions,
      }),
    });
    if (config.region !== undefined) {
      setCookieValue({
        cookieName: i18nConfig.getRegionCookieName(),
        value: config.region,
      });
    }
    this.updateEnableI18n(config.enableI18n ?? true);
  }

  getLocale = (): string => {
    return getBrowserLocale(this.localeCookieName, this.customGetLocale);
  };

  setLocale = (locale: LocaleCandidates): void => {
    this.updateLocale(locale);
    if (this.resetLocaleCookie) {
      setCookieValue({
        cookieName: defaultResetLocaleCookieName,
        value: 'true',
      });
    }
    this.reload();
  };

  getRegion = (): string | undefined => {
    const cookieRegion = getCookieValue({
      cookieName: getI18nConfig().getRegionCookieName(),
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
      cookieName: getI18nConfig().getEnableI18nCookieName(),
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
      value: i18nConfig.resolveSupportedLocale(locale),
      ...(this.localeCookieOptions && {
        options: this.localeCookieOptions,
      }),
    });
  };

  /**
   * Soft region update
   */
  updateRegion = (region: string | undefined): void => {
    setCookieValue({
      cookieName: getI18nConfig().getRegionCookieName(),
      value: region ?? '',
    });
  };

  /**
   * Soft enableI18n update
   */
  updateEnableI18n = (enableI18n: boolean): void => {
    setCookieValue({
      cookieName: getI18nConfig().getEnableI18nCookieName(),
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

function getBrowserLocale(
  localeCookieName: string,
  getLocale?: GetLocale
): string {
  const i18nConfig = getI18nConfig();
  const candidates = readBrowserLocale(localeCookieName);
  if (getLocale) candidates.push(getLocale());
  return i18nConfig.resolveSupportedLocale(candidates);
}
