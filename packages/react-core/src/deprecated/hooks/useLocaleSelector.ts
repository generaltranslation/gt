import { useCallback, useMemo } from 'react';
import useGTContext from '../provider/GTContext';

/**
 *
 * Gets the list of properties for using a locale selector.
 * Provides locale management utilities for the application.
 * @param locales an optional list of locales to use for the drop down. These locales must be a subset of the locales provided by the `<GTProvider>` context. When not provided, the list of locales from the `<GTProvider>` context is used.
 *
 * @returns {Object} An object containing locale-related utilities:
 * @returns {string} return.locale - The currently selected locale.
 * @returns {string[]} return.locales - The list of all available locales.
 * @returns {(locale: string) => void} return.setLocale - Function to update the current locale.
 * @returns {(locale: string) => LocaleProperties} return.getLocaleProperties - Function to retrieve properties for a given locale.
 */
export default function useLocaleSelector(locales?: string[]) {
  // Retrieve the locale, locales, and setLocale function
  const { locales: contextLocales, locale, setLocale, gt } = useGTContext();

  // sort
  const sortedLocales = useMemo(() => {
    if (!contextLocales || contextLocales.length === 0) {
      return [];
    }
    const collator = new Intl.Collator();
    return [...contextLocales].sort((a, b) =>
      collator.compare(
        gt.getLocaleProperties(a).nativeNameWithRegionCode,
        gt.getLocaleProperties(b).nativeNameWithRegionCode
      )
    );
  }, [contextLocales, gt]);

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
