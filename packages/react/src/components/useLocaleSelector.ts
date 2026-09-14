import {
  useInternalLocaleSelector,
  useSetLocale,
} from '@generaltranslation/react-core/hooks';
import { getI18nConfig } from '@generaltranslation/react-core/pure';
import { useMemo } from 'react';

/**
 * Gets the list of properties for using a locale selector.
 * Provides locale management utilities for the application.
 *
 * @param locales an optional list of locales to use for the drop down. These locales must be a subset of the locales provided by the `<GTProvider>` context. When not provided, the list of locales from the `<GTProvider>` context is used.
 *
 * @returns {Object} An object containing locale-related utilities:
 * @returns {string} return.locale - The currently selected locale.
 * @returns {string[]} return.locales - The list of all available locales.
 * @returns {function} return.setLocale - Function to update the current locale.
 * @returns {(locale: string) => LocaleProperties} return.getLocaleProperties - Function to retrieve properties for a given locale.
 */
export function useLocaleSelector(locales?: string[]) {
  const setLocale = useSetLocale();
  const selector = useInternalLocaleSelector(locales);
  const options = useMemo(
    () =>
      locales ??
        // Match useLocale() even when services-enabled config contains canonical
        // codes. The default locale and its canonical code may share one alias.
        [
          ...new Set(
            selector.locales.map((locale) =>
              getI18nConfig().resolveAliasLocale(locale)
            )
          ),
        ],
    [locales, selector.locales]
  );
  return { ...selector, locales: options, setLocale };
}
