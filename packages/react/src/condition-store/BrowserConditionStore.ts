import {
  defaultResetLocaleCookieName,
  getI18nConfig,
} from '@generaltranslation/react-core/pure';
import type { WritableConditionStoreParams } from 'gt-i18n/internal';
import { getCookieValue, setCookieValue } from './cookies';
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
  _localeRouting?: {
    cookieName: string;
    isEnabled: () => boolean;
  };
  _resetLocaleCookieName?: string;
};

/**
 * Condition store implementation for Browser.
 */
export class BrowserConditionStore implements WritableConditionStoreInterface {
  private customReload: ReloadType;
  private customGetLocale?: GetLocale;
  private customGetRegion?: GetRegion;
  private customGetEnableI18n?: GetEnableI18n;
  private localeRouting?: BrowserConditionStoreParams['_localeRouting'];
  private resetLocaleCookieName: string;

  constructor(config: BrowserConditionStoreParams) {
    const i18nConfig = getI18nConfig();
    this.customReload =
      config._reload ??
      (() =>
        typeof window !== 'undefined' ? window.location.reload() : undefined);
    this.customGetLocale = config._getLocale;
    this.customGetRegion = config._getRegion;
    this.customGetEnableI18n = config._getEnableI18n;
    this.localeRouting = config._localeRouting;
    this.resetLocaleCookieName =
      config._resetLocaleCookieName ?? defaultResetLocaleCookieName;
    this.updateLocale(config.locale);
    if (config.region !== undefined) {
      setCookieValue({
        cookieName: i18nConfig.getRegionCookieName(),
        value: config.region,
      });
    }
    this.updateEnableI18n(config.enableI18n ?? true);
  }

  getLocale = (): string => {
    return getBrowserLocale(this.customGetLocale);
  };

  setLocale = (locale: LocaleCandidates): void => {
    const resolvedLocale = getI18nConfig().resolveSupportedLocale(locale);
    const routingLocaleCookieName = this.localeRouting?.isEnabled()
      ? this.localeRouting.cookieName
      : undefined;
    if (routingLocaleCookieName) {
      // Keep the rendered locale until the server accepts the requested route.
      setCookieValue({
        cookieName: routingLocaleCookieName,
        value: resolvedLocale,
      });
    } else {
      this.updateLocale(resolvedLocale);
    }
    setCookieValue({
      cookieName: this.resetLocaleCookieName,
      value: routingLocaleCookieName ?? 'true',
    });
    this.reload(routingLocaleCookieName ? resolvedLocale : undefined);
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
    const resolvedLocale = i18nConfig.resolveSupportedLocale(locale);
    setCookieValue({
      cookieName: i18nConfig.getLocaleCookieName(),
      value: resolvedLocale,
    });
    const routingLocaleCookieName = this.localeRouting?.cookieName;
    // Retire the pending request when a server locale or non-routed choice
    // applies. An older HTTP response could otherwise erase a newer selection.
    if (
      routingLocaleCookieName &&
      getCookieValue({ cookieName: routingLocaleCookieName })
    ) {
      setCookieValue({
        cookieName: routingLocaleCookieName,
        value: '',
      });
    }
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
  reload = (locale = this.getLocale()): void => {
    const state = {
      locale,
      region: this.getRegion(),
      enableI18n: this.getEnableI18n(),
    };
    this.customReload(state);
  };
}

function getBrowserLocale(getLocale?: GetLocale): string {
  const i18nConfig = getI18nConfig();
  const candidates = readBrowserLocale(i18nConfig.getLocaleCookieName());
  if (getLocale) candidates.push(getLocale());
  return i18nConfig.resolveSupportedLocale(candidates);
}
