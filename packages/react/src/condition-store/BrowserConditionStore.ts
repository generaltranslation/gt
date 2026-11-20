import { getI18nConfig } from '@generaltranslation/react-core/pure';
import { defaultResetLocaleCookieName } from 'gt-i18n/internal/cookies';
import {
  LocaleCandidates,
  WritableConditionStoreInterface,
  type WritableConditionStoreParams,
} from 'gt-i18n/internal';
import { getCookieValue, getTaskCookies, setCookieValue } from './cookies';
import {
  getTaskNavigatorLocales,
  readBrowserLocale,
} from './readBrowserLocale';
import { GetEnableI18n, GetLocale, GetRegion } from '../i18n-cache/types';

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
};

/**
 * Condition store implementation for Browser.
 */
export class BrowserConditionStore implements WritableConditionStoreInterface {
  private customReload: ReloadType;
  private customGetLocale?: GetLocale;
  private customGetRegion?: GetRegion;
  private customGetEnableI18n?: GetEnableI18n;

  constructor(config: BrowserConditionStoreParams) {
    const i18nConfig = getI18nConfig();
    this.customReload =
      config._reload ??
      (() =>
        typeof window !== 'undefined' ? window.location.reload() : undefined);
    this.customGetLocale = config._getLocale;
    this.customGetRegion = config._getRegion;
    this.customGetEnableI18n = config._getEnableI18n;
    setCookieValue({
      cookieName: i18nConfig.getLocaleCookieName(),
      value: i18nConfig.resolveSupportedLocale(config.locale),
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
    return getBrowserLocale(this.customGetLocale);
  };

  setLocale = (locale: LocaleCandidates): void => {
    this.updateLocale(locale);
    setCookieValue({
      cookieName: defaultResetLocaleCookieName,
      value: 'true',
    });
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
    // App Router does not resolve this preference on the server yet, so retain
    // its existing client behavior rather than accepting the server's true.
    const cookieEnableI18n = getTaskConditions().enableI18n;
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
      cookieName: i18nConfig.getLocaleCookieName(),
      value: i18nConfig.resolveSupportedLocale(locale),
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

// Matching the candidates to a configured locale costs more than rendering a
// message, so the last match is kept.
let lastMatch:
  | { config: unknown; candidates: string; locale: string }
  | undefined;

// Every message reads its conditions. The cookies and the navigator are read
// once per task, so most calls find both as they were and resolve nothing.
let lastRead:
  | {
      config: unknown;
      cookies: unknown;
      languages: readonly string[];
      locale: string;
      enableI18n: string | undefined;
    }
  | undefined;

function getTaskConditions(): NonNullable<typeof lastRead> {
  const i18nConfig = getI18nConfig();
  const cookies = getTaskCookies();
  const languages = getTaskNavigatorLocales();
  if (
    lastRead?.config !== i18nConfig ||
    lastRead.cookies !== cookies ||
    lastRead.languages !== languages
  ) {
    lastRead = {
      config: i18nConfig,
      cookies,
      languages,
      locale: matchLocale(
        i18nConfig,
        readBrowserLocale(i18nConfig.getLocaleCookieName())
      ),
      enableI18n: getCookieValue({
        cookieName: i18nConfig.getEnableI18nCookieName(),
      }),
    };
  }
  return lastRead;
}

function getBrowserLocale(getLocale?: GetLocale): string {
  // A custom reader may answer differently on every call.
  if (getLocale) {
    const i18nConfig = getI18nConfig();
    const candidates = readBrowserLocale(i18nConfig.getLocaleCookieName());
    candidates.push(getLocale());
    return matchLocale(i18nConfig, candidates);
  }
  return getTaskConditions().locale;
}

function matchLocale(
  i18nConfig: ReturnType<typeof getI18nConfig>,
  candidates: string[]
): string {
  const key = candidates.join();
  if (lastMatch?.config !== i18nConfig || lastMatch.candidates !== key) {
    lastMatch = {
      config: i18nConfig,
      candidates: key,
      locale: i18nConfig.resolveSupportedLocale(candidates),
    };
  }
  return lastMatch.locale;
}
