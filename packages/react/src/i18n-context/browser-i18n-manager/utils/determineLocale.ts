import { CustomMapping } from 'generaltranslation/types';
import { determineLocale as gtDetermineLocale } from 'generaltranslation';
import { getCookieValue } from './cookies';
import { defaultLocaleCookieName } from '@generaltranslation/react-core/internal';
import { createNoLocaleCouldBeDeterminedFromCustomGetLocaleWarning } from '../../../shared/messages';
import { GetLocale } from './types';

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
  defaultLocale: string;
  locales: string[];
  customMapping?: CustomMapping;
  localeCookieName?: string;
  getLocale?: GetLocale;
}): string {
  // (1) Check custom locale
  if (getLocale) {
    const customLocale = getLocale();
    const determinedLocale = gtDetermineLocale(
      customLocale,
      locales,
      customMapping
    );
    if (!determinedLocale) {
      console.warn(
        createNoLocaleCouldBeDeterminedFromCustomGetLocaleWarning({
          customLocale,
          defaultLocale,
        })
      );
      return defaultLocale;
    }
    return determinedLocale;
  }

  const candidates = [];

  // (1) Check cookie
  const cookieLocale = getCookieValue({
    cookieName: localeCookieName,
  });
  if (cookieLocale) candidates.push(cookieLocale);

  // (2) Check navigator locales
  const navigatorLocales = navigator?.languages || [];
  candidates.push(...navigatorLocales);

  return gtDetermineLocale(candidates, locales, customMapping) || defaultLocale;
}
