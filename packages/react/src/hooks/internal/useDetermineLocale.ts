import { useState, useEffect } from 'react';
import { determineLocale } from 'generaltranslation';
import {
  libraryDefaultLocale,
  localeCookieName,
} from 'generaltranslation/internal';
import { createUnsupportedLocaleWarning } from '../../errors/createErrors';

export function useDetermineLocale({
  locale: _locale = '',
  defaultLocale = libraryDefaultLocale,
  locales = [],
  cookieName = localeCookieName,
  ssr = true, // when false, breaks server side rendering by accessing document and navigator on first render
}: {
  defaultLocale: string;
  locales: string[];
  locale?: string;
  cookieName?: string;
  ssr?: boolean;
}): [string, (locale: string) => void] {
  // maintaining the state of locale
  const [locale, _setLocale] = useState<string>(
    ssr
      ? _locale
        ? determineLocale(_locale, locales) || ''
        : ''
      : getNewLocale({
          _locale,
          locale: _locale,
          locales,
          defaultLocale,
          cookieName,
        })
  );

  const [setLocale, internalSetLocale] = createSetLocale({
    locale,
    locales,
    defaultLocale,
    cookieName,
    _setLocale,
  });

  // check brower for locales
  useEffect(() => {
    const newLocale = getNewLocale({
      _locale,
      locale,
      locales,
      defaultLocale,
      cookieName,
    });
    internalSetLocale(newLocale);
  }, [_locale, locale, locales, defaultLocale, cookieName]);

  return [locale, setLocale];
}

// ----- HELPER FUNCTIONS ---- //

function getNewLocale({
  _locale,
  locale,
  locales,
  defaultLocale,
  cookieName,
}: {
  _locale: string;
  locale: string;
  locales: string[];
  defaultLocale: string;
  cookieName: string;
}): string {
  if (
    _locale &&
    _locale === locale &&
    determineLocale(_locale, locales) === locale
  )
    return _locale;

  // check user's configured locales
  const browserLocales = (() => {
    if (navigator?.languages) return navigator.languages;
    if (navigator?.language) return [navigator.language];
    if ((navigator as any)?.userLanguage)
      return [(navigator as any)?.userLanguage];
    return [defaultLocale];
  })() as string[];

  // Check for locale in cookie
  const cookieLocale =
    typeof document !== 'undefined'
      ? document.cookie
          .split('; ')
          .find((row) => row.startsWith(`${cookieName}=`))
          ?.split('=')[1]
      : undefined;

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

  // return new locale
  return newLocale;
}

function createSetLocale({
  locale,
  locales,
  defaultLocale,
  cookieName,
  _setLocale,
}: {
  locale: string;
  locales: string[];
  defaultLocale: string;
  cookieName: string;
  _setLocale: any;
}) {
  const internalSetLocale = (newLocale: string): string => {
    // validate locale
    const validatedLocale =
      determineLocale(newLocale, locales) || locale || defaultLocale;
    if (validatedLocale !== newLocale) {
      console.warn(createUnsupportedLocaleWarning(validatedLocale, newLocale));
    }
    // persist locale
    _setLocale(validatedLocale);

    return validatedLocale;
  };
  // update locale and store it in cookie
  const setLocale = (newLocale: string): void => {
    const validatedLocale = internalSetLocale(newLocale);
    document.cookie = `${cookieName}=${validatedLocale};path=/`;
  };
  return [setLocale, internalSetLocale];
}
