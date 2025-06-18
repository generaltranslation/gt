import { useCallback, useMemo } from 'react';
import useLocale from '../hooks/useLocale';
import useLocales from '../hooks/useLocales';
import useSetLocale from '../hooks/useSetLocale';
import { useGTClass } from './useGTClass';

/**
 /**
 * Gets the list of properties for using a locale selector.
 * Provides locale management utilities for the application.
 * @param locales an optional list of locales to use for the drop down. These locales must be a subset of the locales provided by the `<GTProvider>` context. When not provided, the list of locales from the `<GTProvider>` context is used.
 * Provides locale management utilities for the application.
 *
 * @returns {Object} An object containing locale-related utilities:
 * @returns {string} return.locale - The currently selected locale.
 * @returns {string[]} return.locales - The list of all available locales.
 * @returns {(locale: string) => void} return.setLocale - Function to update the current locale.
 * @returns {(locale: string) => LocaleProperties} return.getLocaleProperties - Function to retrieve properties for a given locale.
 */
export default function useLocaleSelector(locales?: string[]) {
  // Retrieve the locale, locales, and setLocale function
  const contextLocales = useLocales();
  const locale = useLocale();
  const setLocale = useSetLocale();
  const gt = useGTClass();

  // sort
  const sortedLocales = useMemo(() => {
    if (!contextLocales || contextLocales.length === 0) {
      return [];
    }
    const res = contextLocales.sort((a, b) =>
      new Intl.Collator().compare(
        gt.getLocaleProperties(a).nativeNameWithRegionCode,
        gt.getLocaleProperties(b).nativeNameWithRegionCode
      )
    );
    return res;
  }, [contextLocales]);

  // create getLocaleProperties callback
  const getLocalePropertiesCallback = useCallback(
    (locale: string) => {
      return gt.getLocaleProperties(locale);
    },
    [gt]
  );

  return {
    locale,
    locales: locales ? locales : sortedLocales,
    setLocale,
    getLocaleProperties: getLocalePropertiesCallback,
  };
}
