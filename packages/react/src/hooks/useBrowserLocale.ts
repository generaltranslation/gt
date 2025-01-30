import { useState, useEffect } from 'react';
import { determineLocale } from 'generaltranslation';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import { listSupportedLocales } from '@generaltranslation/supported-locales';

/**
 * Hook to retrieve the browser's default locale, with support for a fallback and locale stored in a cookie.
 *
 * @param {string} [defaultLocale=libraryDefaultLocale] - The default locale to use if the browser locale is not available.
 * @param {string} [cookieName=localeCookieName] - The name of the cookie to check for a stored locale. If omitted, no cookie is used.
 * @returns {string} The resolved browser locale, either from the cookie, browser settings, or the default locale.
 *
 * @example
 * const browserLocale = useBrowserLocale('en-US');
 * console.log(browserLocale); // Outputs the browser's locale, or 'en-US' if unavailable
 *
 * @example
 * const browserLocale = useBrowserLocale('fr', 'localeCookie');
 * console.log(browserLocale); // Outputs locale from cookie 'localeCookie' if available, or browser's locale otherwise
 *
 * @description
 * This hook attempts to determine the browser's preferred locale. If a locale is stored in a cookie (specified by `cookieName`),
 * it will take precedence. If not, it falls back to the `navigator.language` or `navigator.userLanguage`. If none of these are available,
 * the provided `defaultLocale` is used.
 */
export default function useBrowserLocale(
  defaultLocale: string = libraryDefaultLocale,
  locales: string[] = listSupportedLocales()
): string {
  const [locale, setLocale] = useState<string>('');
  useEffect(() => {
    const browserLocales = (() => {
      if (navigator?.languages) return navigator.languages;
      if (navigator?.language) return [navigator.language];
      if ((navigator as any)?.userLanguage)
        return [(navigator as any)?.userLanguage];
      return [defaultLocale];
    })() as string[];
    setLocale(determineLocale(browserLocales, locales) || defaultLocale);
  }, [defaultLocale, locales]);
  return locale;
}
