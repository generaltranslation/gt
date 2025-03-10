import { useState, useEffect } from 'react';
import { determineLocale } from 'generaltranslation';
import {
  libraryDefaultLocale,
  localeCookieName,
} from 'generaltranslation/internal';
import { createUnsupportedLocaleWarning } from '../../errors/createErrors';

/**
 *
 * @param defaultLocale
 * @param locales
 * @param locale
 * @param cookieName
 * @returns locale, and setLocale (will override user's browser preferences unless a locale is explicitly passed)
 */
export default function useDetermineLocale({
  locale: _locale = '',
  defaultLocale = libraryDefaultLocale,
  locales = [],
  cookieName = localeCookieName,
}: {
  defaultLocale: string;
  locales: string[];
  locale?: string;
  cookieName?: string;
}): [string, (locale: string) => void] {
  // maintaining the state of locale
  const [locale, _setLocale] = useState<string>(
    _locale ? determineLocale(_locale, locales) || '' : ''
  );

  // update locale and store it in cookie
  const setLocale = (newLocale: string): void => {
    // validate locale
    const validatedLocale =
      determineLocale(newLocale, locales) || locale || defaultLocale;
    if (validatedLocale !== newLocale) {
      console.warn(createUnsupportedLocaleWarning(validatedLocale, newLocale));
    }

    // persist locale
    _setLocale(validatedLocale);
    document.cookie = `${cookieName}=${validatedLocale};path=/`;
  };

  // check brower for locales
  useEffect(() => {
    if (
      _locale &&
      _locale === locale &&
      determineLocale(_locale, locales) === locale
    )
      return;

    // check user's configured locales
    const browserLocales = (() => {
      if (navigator?.languages) return navigator.languages;
      if (navigator?.language) return [navigator.language];
      if ((navigator as any)?.userLanguage)
        return [(navigator as any)?.userLanguage];
      return [defaultLocale];
    })() as string[];

    // Check for locale in cookie
    const cookieLocale = document.cookie
      .split('; ')
      .find((row) => row.startsWith(`${cookieName}=`))
      ?.split('=')[1];

    // determine locale
    const newLocale =
      determineLocale(
        [
          ...(_locale ? [_locale] : []), // prefer user passed locale
          ...(cookieLocale ? [cookieLocale] : []), // then prefer cookie locale
          ...browserLocales, // then prefer browser locale
        ],
        locales
      ) || defaultLocale;

    // if cookie not valid, change it back to whatever we use for fallback
    if (cookieLocale && cookieLocale !== newLocale) {
      document.cookie = `${cookieName}=${newLocale};path=/`;
    }

    // update locale
    _setLocale(newLocale);
  }, [defaultLocale, locales]);
  return [locale, setLocale];
}
