import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  determineLocale,
  resolveAliasLocale,
} from '@generaltranslation/format';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import { createUnsupportedLocaleWarning } from '@generaltranslation/react-core/errors';
import { defaultLocaleCookieName } from '@generaltranslation/react-core/internal';
import type { CustomMapping } from '@generaltranslation/format/types';
import type {
  UseDetermineLocaleParams,
  UseDetermineLocaleReturn,
} from '@generaltranslation/react-core/types';
import { PACKAGE_NAME } from '../../../../shared/messages';
import { getCookieValue, setCookieValue } from '../../../../shared/cookies';

export function useDetermineLocale({
  locale: initialLocale = '',
  defaultLocale = libraryDefaultLocale,
  locales: initialLocales = [],
  localeCookieName = defaultLocaleCookieName,
  // when false, breaks server side rendering by accessing document and navigator on first render
  ssr = true,
  customMapping,
  // when enabled, don't change locale cookie (feature flag might be loaded async, updating cookie means state is lost on refresh)
  enableI18n,
  // for syncing server locale with client locale
  reloadOnLocaleUpdate = false,
  onLocaleUpdate,
}: UseDetermineLocaleParams): UseDetermineLocaleReturn {
  // resolve alias locale
  const _locale = useMemo(
    () => resolveAliasLocale(initialLocale, customMapping),
    [initialLocale, customMapping]
  );
  const locales = useMemo(
    () =>
      initialLocales.map((locale) => resolveAliasLocale(locale, customMapping)),
    [initialLocales, customMapping]
  );

  /**
   * Choose a locale to use
   * (1) use provided locale
   * (2) use cookie locale
   * (3) use preferred locale
   * (5) fallback to defaultLocale
   * Update the cookie locale to be correct
   */
  const getNewLocale = useCallback(
    (locale: string) => {
      if (!enableI18n) return defaultLocale;

      // No change, return
      if (
        _locale &&
        _locale === locale &&
        determineLocale(_locale, locales, customMapping) === locale
      ) {
        return _locale;
      }

      // Check for locale in cookie
      let cookieLocale = getCookieValue(localeCookieName);
      if (cookieLocale) {
        cookieLocale = resolveAliasLocale(cookieLocale, customMapping);
      }

      // check user's configured locales
      const browserLocales = getBrowserLocales(customMapping);

      // determine locale
      let newLocale =
        determineLocale(
          [
            // prefer user passed locale
            ...(_locale ? [_locale] : []),
            // then prefer cookie locale
            ...(cookieLocale ? [cookieLocale] : []),
            // then prefer browser locale
            ...browserLocales,
          ],
          locales,
          customMapping
        ) || defaultLocale;
      if (newLocale) {
        newLocale = resolveAliasLocale(newLocale, customMapping);
      }

      // if cookie not valid, change it back to whatever we use for fallback
      if (cookieLocale && cookieLocale !== newLocale) {
        setCookieValue(localeCookieName, newLocale);
      }

      // return new locale
      return newLocale;
    },
    [
      _locale,
      customMapping,
      defaultLocale,
      enableI18n,
      localeCookieName,
      locales,
    ]
  );

  const initializeLocale = () => {
    if (!enableI18n) return defaultLocale;
    return resolveAliasLocale(
      ssr
        ? _locale
          ? determineLocale(_locale, locales, customMapping) || ''
          : ''
        : getNewLocale(_locale),
      customMapping
    );
  };

  // maintaining the state of locale
  const [locale, _setLocale] = useState<string>(initializeLocale);

  const currentLocale = resolveAliasLocale(locale, customMapping);
  const setLocaleWithoutSettingCookie = useCallback(
    (newLocale: string): string => {
      if (!enableI18n) return defaultLocale;
      // avoid superfluous updates
      if (newLocale === currentLocale) return currentLocale;

      // validate locale
      const validatedLocale = resolveAliasLocale(
        determineLocale(newLocale, locales, customMapping) ||
          currentLocale ||
          defaultLocale,
        customMapping
      );
      if (validatedLocale !== newLocale) {
        console.warn(
          createUnsupportedLocaleWarning(
            validatedLocale,
            newLocale,
            PACKAGE_NAME
          )
        );
      }
      // persist locale
      _setLocale(validatedLocale);
      return validatedLocale;
    },
    [currentLocale, customMapping, defaultLocale, enableI18n, locales]
  );

  // update locale and store it in cookie
  const setLocale = (newLocale: string): void => {
    if (!enableI18n) return;
    newLocale = resolveAliasLocale(newLocale, customMapping);
    const validatedLocale = setLocaleWithoutSettingCookie(newLocale);
    setCookieValue(localeCookieName, validatedLocale);
    onLocaleUpdate?.(validatedLocale);

    if (
      typeof window !== 'undefined' &&
      newLocale !== currentLocale &&
      reloadOnLocaleUpdate
    ) {
      // Reload the page so server responses will be using the same locale as the client
      // This is useful for frameworks such as Tanstack that rely on the locale being set on the server
      window.location.reload();
    }
  };

  // check browser for locales
  useEffect(() => {
    setLocaleWithoutSettingCookie(getNewLocale(locale));
  }, [locale, setLocaleWithoutSettingCookie, getNewLocale]);

  return [locale, setLocale];
}

// ----- HELPER FUNCTIONS ---- //

function getBrowserLocales(customMapping?: CustomMapping) {
  if (typeof navigator === 'undefined') {
    return [];
  }

  const legacyNavigator = navigator as Navigator & {
    userLanguage?: string;
  };
  const locales =
    navigator.languages ||
    (navigator.language
      ? [navigator.language]
      : legacyNavigator.userLanguage
        ? [legacyNavigator.userLanguage]
        : []);

  return locales.map((locale) => resolveAliasLocale(locale, customMapping));
}
