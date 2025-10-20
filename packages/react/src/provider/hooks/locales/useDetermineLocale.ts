import { useState, useEffect } from 'react';
import { determineLocale, resolveAliasLocale } from 'generaltranslation';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import { createUnsupportedLocaleWarning } from '@generaltranslation/react-core/errors';
import { defaultLocaleCookieName } from '@generaltranslation/react-core/internal';
import { CustomMapping } from 'generaltranslation/types';
import {
  UseDetermineLocaleParams,
  UseDetermineLocaleReturn,
} from '@generaltranslation/react-core/types';

export function useDetermineLocale({
  locale: _locale = '',
  defaultLocale = libraryDefaultLocale,
  locales = [],
  localeCookieName = defaultLocaleCookieName,
  ssr = true, // when false, breaks server side rendering by accessing document and navigator on first render
  customMapping,
}: UseDetermineLocaleParams): UseDetermineLocaleReturn {
  // resolve alias locale
  _locale = resolveAliasLocale(_locale, customMapping);
  locales = locales.map((locale) => resolveAliasLocale(locale, customMapping));

  const initializeLocale = () => {
    const result = resolveAliasLocale(
      ssr
        ? _locale
          ? determineLocale(_locale, locales, customMapping) || ''
          : ''
        : getNewLocale({
            _locale,
            locale: _locale,
            locales,
            defaultLocale,
            localeCookieName,
            customMapping,
          }),
      customMapping
    );
    return result;
  };

  // maintaining the state of locale
  const [locale, _setLocale] = useState<string>(initializeLocale());

  // Functions for setting internal locale state
  const [setLocale, setLocaleWithoutSettingCookie] = createSetLocale({
    locale,
    locales,
    defaultLocale,
    localeCookieName,
    _setLocale,
    customMapping,
  });

  // check browser for locales
  useEffect(() => {
    const newLocale = getNewLocale({
      _locale,
      locale,
      locales,
      defaultLocale,
      localeCookieName,
      customMapping,
    });
    setLocaleWithoutSettingCookie(newLocale);
  }, [_locale, locale, locales, defaultLocale, localeCookieName]);

  return [locale, setLocale];
}

// ----- HELPER FUNCTIONS ---- //

/**
 * Choose a locale to use
 * (1) use provided locale
 * (2) use cookie locale
 * (3) use preferred locale
 * (5) fallback to defaultLocale
 * Update the cookie locale to be correct
 */
function getNewLocale({
  _locale,
  locale,
  locales,
  defaultLocale,
  localeCookieName,
  customMapping,
}: {
  _locale: string;
  locale: string;
  locales: string[];
  defaultLocale: string;
  localeCookieName: string;
  customMapping?: CustomMapping;
}): string {
  // No change, return
  if (
    _locale &&
    _locale === locale &&
    determineLocale(_locale, locales, customMapping) === locale
  ) {
    return resolveAliasLocale(_locale, customMapping);
  }

  // Check for locale in cookie
  let cookieLocale =
    typeof document !== 'undefined'
      ? document.cookie
          .split('; ')
          .find((row) => row.startsWith(`${localeCookieName}=`))
          ?.split('=')[1]
      : undefined;
  if (cookieLocale) {
    cookieLocale = resolveAliasLocale(cookieLocale, customMapping);
  }

  // check user's configured locales
  let browserLocales = (() => {
    if (typeof navigator === 'undefined') {
      return [defaultLocale];
    }
    if (navigator?.languages) return navigator.languages;
    if (navigator?.language) return [navigator.language];
    if ((navigator as any)?.userLanguage)
      return [(navigator as any)?.userLanguage];
    return [defaultLocale];
  })() as string[];
  browserLocales = browserLocales.map((locale) =>
    resolveAliasLocale(locale, customMapping)
  );

  // determine locale
  let newLocale =
    determineLocale(
      [
        ...(_locale ? [_locale] : []), // prefer user passed locale
        ...(cookieLocale ? [cookieLocale] : []), // then prefer cookie locale
        ...browserLocales, // then prefer browser locale
      ],
      locales,
      customMapping
    ) || defaultLocale;
  if (newLocale) {
    newLocale = resolveAliasLocale(newLocale, customMapping);
  }

  // if cookie not valid, change it back to whatever we use for fallback
  if (
    cookieLocale &&
    cookieLocale !== newLocale &&
    typeof document !== 'undefined'
  ) {
    document.cookie = `${localeCookieName}=${newLocale};path=/`;
  }

  // return new locale
  return newLocale;
}

function createSetLocale({
  locale,
  locales,
  defaultLocale,
  localeCookieName,
  _setLocale,
  customMapping,
}: {
  locale: string;
  locales: string[];
  defaultLocale: string;
  localeCookieName: string;
  _setLocale: any;
  customMapping?: CustomMapping;
}) {
  locale = resolveAliasLocale(locale, customMapping);
  const setLocaleWithoutSettingCookie = (newLocale: string): string => {
    // validate locale
    const validatedLocale = resolveAliasLocale(
      determineLocale(newLocale, locales, customMapping) ||
        locale ||
        defaultLocale,
      customMapping
    );
    if (validatedLocale !== newLocale) {
      console.warn(createUnsupportedLocaleWarning(validatedLocale, newLocale));
    }
    // persist locale
    _setLocale(validatedLocale);

    return validatedLocale;
  };
  // update locale and store it in cookie
  const setLocale = (newLocale: string): void => {
    newLocale = resolveAliasLocale(newLocale);
    const validatedLocale = setLocaleWithoutSettingCookie(newLocale);
    if (typeof document !== 'undefined') {
      document.cookie = `${localeCookieName}=${validatedLocale};path=/`;
    }
  };
  return [setLocale, setLocaleWithoutSettingCookie];
}
