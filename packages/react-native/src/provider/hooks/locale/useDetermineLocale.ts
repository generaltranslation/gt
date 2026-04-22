import { useEffect, useState } from 'react';
import { determineLocale, resolveAliasLocale } from 'generaltranslation';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import type { CustomMapping } from 'generaltranslation/types';
import type {
  UseDetermineLocaleParams,
  UseDetermineLocaleReturn,
} from '@generaltranslation/react-core/types';
import { getNativeLocales } from '../../../utils/getNativeLocales';
import { nativeStoreGet, nativeStoreSet } from '../../../utils/nativeStore';

export function useDetermineLocale({
  locale: _locale = '',
  defaultLocale = libraryDefaultLocale,
  locales = [],
  localeCookieName = 'generaltranslation.locale',
  ssr = false, // not relevant
  customMapping,
  enableI18n,
}: UseDetermineLocaleParams): UseDetermineLocaleReturn {
  // resolve alias locale
  _locale = resolveAliasLocale(_locale, customMapping);
  locales = locales.map((locale) => resolveAliasLocale(locale, customMapping));

  const initializeLocale = () => {
    if (!enableI18n) {
      return defaultLocale;
    }
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
            enableI18n,
          }),
      customMapping
    );
    return result;
  };

  // maintaining the state of locale
  const [locale, _setLocale] = useState<string>(initializeLocale());

  // Functions for setting internal locale state
  const [setLocale, setLocaleWithoutPersist] = createSetLocale({
    locale,
    locales,
    defaultLocale,
    localeCookieName,
    _setLocale,
    customMapping,
    enableI18n,
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
      enableI18n,
    });
    setLocaleWithoutPersist(newLocale);
  }, [
    _locale,
    locale,
    locales,
    defaultLocale,
    localeCookieName,
    customMapping,
    setLocaleWithoutPersist,
    enableI18n,
  ]);

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
  enableI18n,
}: {
  _locale: string;
  locale: string;
  locales: string[];
  defaultLocale: string;
  localeCookieName: string;
  customMapping?: CustomMapping;
  enableI18n: boolean;
}): string {
  if (!enableI18n) {
    return defaultLocale;
  }
  // No change, return
  if (
    _locale &&
    _locale === locale &&
    determineLocale(_locale, locales, customMapping) === locale
  ) {
    return resolveAliasLocale(_locale, customMapping);
  }

  // Check for locale in native store
  let storedLocale = nativeStoreGet(localeCookieName);
  if (storedLocale) {
    storedLocale = resolveAliasLocale(storedLocale, customMapping);
  }

  // check user's configured locales
  let preferredLocales = getNativeLocales();
  if (preferredLocales.length === 0) preferredLocales = [defaultLocale];
  preferredLocales = preferredLocales.map((l) =>
    resolveAliasLocale(l, customMapping)
  );

  // determine locale
  let newLocale =
    determineLocale(
      [
        ...(_locale ? [_locale] : []), // prefer user passed locale
        ...(storedLocale ? [storedLocale] : []), // then prefer stored locale
        ...preferredLocales, // then prefer browser locale
      ],
      locales,
      customMapping
    ) || defaultLocale;
  if (newLocale) {
    newLocale = resolveAliasLocale(newLocale, customMapping);
  }

  // if stored locale not valid, change it back to whatever we use for fallback
  if (storedLocale && storedLocale !== newLocale) {
    nativeStoreSet(localeCookieName, newLocale);
  }

  // return new locale
  return newLocale;
}

function createSetLocale({
  locale,
  locales,
  defaultLocale,
  _setLocale,
  localeCookieName,
  customMapping,
  enableI18n,
}: {
  locale: string;
  locales: string[];
  defaultLocale: string;
  localeCookieName: string;
  _setLocale: any;
  customMapping?: CustomMapping;
  enableI18n: boolean;
}): [(newLocale: string) => void, (newLocale: string) => void] {
  locale = resolveAliasLocale(locale, customMapping);
  // Just update the internal state, don't persist it
  const setLocaleWithoutPersist = (newLocale: string): string => {
    if (!enableI18n) {
      return defaultLocale;
    }
    // validate locale
    const validatedLocale = resolveAliasLocale(
      determineLocale(newLocale, locales, customMapping) ||
        locale ||
        defaultLocale,
      customMapping
    );
    if (validatedLocale !== newLocale) {
      console.warn(
        `[gt-react-native] Unsupported locale: ${validatedLocale} -> ${newLocale}`
      );
    }
    // persist locale
    _setLocale(validatedLocale);

    return validatedLocale;
  };
  // update locale and persist it in native store
  const setLocale = (newLocale: string): void => {
    if (!enableI18n) {
      return;
    }
    newLocale = resolveAliasLocale(newLocale, customMapping);
    setLocaleWithoutPersist(newLocale);
    const validatedLocale = setLocaleWithoutPersist(newLocale);
    nativeStoreSet(localeCookieName, validatedLocale);
  };
  return [setLocale, setLocaleWithoutPersist];
}
