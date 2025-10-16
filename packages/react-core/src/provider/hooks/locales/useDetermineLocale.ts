import { useState, useEffect } from 'react';
import { determineLocale, resolveAliasLocale } from 'generaltranslation';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import { createUnsupportedLocaleWarning } from '../../../errors/createErrors';
import { defaultLocaleCookieName } from '../../../utils/cookies';
import { UseDetermineLocaleProps, UseDetermineLocaleReturn } from './types';
import { CustomMapping } from 'generaltranslation/types';

export function useDetermineLocale({
  locale: _locale = '',
  defaultLocale = libraryDefaultLocale,
  locales = [],
  localeCookieName = defaultLocaleCookieName,
  ssr = true, // when false, breaks server side rendering by accessing document and navigator on first render
  customMapping,
}: UseDetermineLocaleProps): UseDetermineLocaleReturn {
  // resolve alias locale
  _locale = resolveAliasLocale(_locale, customMapping);
  locales = locales.map((locale) => resolveAliasLocale(locale, customMapping));

  // maintaining the state of locale
  const [locale, _setLocale] = useState<string>(
    resolveAliasLocale(
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
    )
  );

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
  if (
    _locale &&
    _locale === locale &&
    determineLocale(_locale, locales, customMapping) === locale
  )
    return resolveAliasLocale(_locale, customMapping);

  // check user's configured locales
  let browserLocales = (() => {
    if (navigator?.languages) return navigator.languages;
    if (navigator?.language) return [navigator.language];
    if ((navigator as any)?.userLanguage)
      return [(navigator as any)?.userLanguage];
    return [defaultLocale];
  })() as string[];
  browserLocales = browserLocales.map((locale) =>
    resolveAliasLocale(locale, customMapping)
  );

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
