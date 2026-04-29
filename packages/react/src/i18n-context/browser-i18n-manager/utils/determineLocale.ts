import { getCookieValue } from './cookies';
import { defaultLocaleCookieName } from '@generaltranslation/react-core/internal';
import { createNoLocaleCouldBeDeterminedFromCustomGetLocaleWarning } from '../../../shared/messages';
import type { GetLocale } from './types';
import {
  determineSupportedLocale,
  resolveSupportedLocale,
} from 'gt-i18n/internal';
import type { ConditionStoreConfig } from 'gt-i18n/internal/types';

/**
 * Determine a user's locale from their browser settings
 * @param {string} locales - The accepted locales
 * @param {CustomMapping} [customMapping] - The custom mapping
 * @param {string} [cookieName=defaultLocaleCookieName] - The name of the cookie to check
 * @returns The determined locale
 *
 */
export function determineLocale({
  defaultLocale,
  locales,
  customMapping,
  localeCookieName = defaultLocaleCookieName,
  getLocale,
}: {
  localeCookieName?: string;
  getLocale?: GetLocale;
} & ConditionStoreConfig): string {
  const localeConfig: ConditionStoreConfig = {
    defaultLocale,
    locales,
    customMapping,
  };
  const resolvedDefaultLocale = resolveSupportedLocale(undefined, localeConfig);

  // (1) Check custom locale
  if (getLocale) {
    const customLocale = getLocale();
    // A custom getLocale is authoritative: if it returns an unsupported locale, warn and fall back.
    const determinedLocale = determineSupportedLocale(
      customLocale,
      localeConfig
    );
    if (!determinedLocale) {
      console.warn(
        createNoLocaleCouldBeDeterminedFromCustomGetLocaleWarning({
          customLocale,
          defaultLocale: resolvedDefaultLocale,
        })
      );
      return resolvedDefaultLocale;
    }
    return determinedLocale;
  }

  const candidates = [];

  // (2) Check cookie
  const cookieLocale = getCookieValue({
    cookieName: localeCookieName,
  });
  if (cookieLocale) candidates.push(cookieLocale);

  // (2) Check navigator locales
  const navigatorLocales = navigator?.languages || [];
  candidates.push(...navigatorLocales);

  return resolveSupportedLocale(candidates, localeConfig);
}
