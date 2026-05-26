import {
  defaultEnableI18nCookieName,
  defaultLocaleCookieName,
} from '@generaltranslation/react-core/internal';
import { getCookieValue, setCookieValue } from '../../shared/cookies';
import { determineLocale } from './utils/determineLocale';
import type { GetLocale } from './utils/types';
import type {
  LocaleResolverConfig,
  WritableConditionStoreInterface,
} from 'gt-i18n/internal/types';

/**
 * The configuration for the BrowserConditionStore
 * @param {string[]} locales - The accepted locales
 * @param {CustomMapping} [customMapping] - The custom mapping
 * @param {GetLocale} getLocale - The function to get the locale
 * @param {string} [localeCookieName=defaultLocaleCookieName] - The name of the locale cookie to check
 */
type BrowserConditionStoreConstructorParams = LocaleResolverConfig & {
  getLocale?: GetLocale;
  localeCookieName?: string;
  enableI18nCookieName?: string;
};

/**
 * Condition store implementation for Browser.
 */
export class BrowserConditionStore implements WritableConditionStoreInterface {
  private readonly localeConfig: LocaleResolverConfig;
  private readonly customGetLocale?: GetLocale;
  private readonly localeCookieName: string;
  private readonly enableI18nCookieName: string;
  /**
   * @param {BrowserConditionStoreConstructorParams} params - The configuration for the BrowserConditionStore
   */
  constructor({
    getLocale,
    localeCookieName = defaultLocaleCookieName,
    enableI18nCookieName = defaultEnableI18nCookieName,
    ...localeConfig
  }: BrowserConditionStoreConstructorParams = {}) {
    this.localeConfig = localeConfig;
    this.customGetLocale = getLocale;
    this.localeCookieName = localeCookieName;
    this.enableI18nCookieName = enableI18nCookieName;
  }

  /**
   * Get the current locale.
   */
  getLocale(): string {
    return determineLocale({
      ...this.localeConfig,
      getLocale: this.customGetLocale,
      localeCookieName: this.localeCookieName,
    });
  }

  setLocale(locale: string): void {
    setCookieValue(this.localeCookieName, locale);
  }

  getEnableI18n(): boolean {
    const cookieEnableI18n = getCookieValue(this.enableI18nCookieName);
    return cookieEnableI18n === 'true' || cookieEnableI18n === undefined;
  }

  setEnableI18n(enableI18n: boolean): void {
    setCookieValue(this.enableI18nCookieName, enableI18n ? 'true' : 'false');
  }
}
