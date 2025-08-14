import React from 'react';
import useLocaleSelector from '../hooks/useLocaleSelector';
<<<<<<< HEAD
=======
import { CustomMapping } from 'generaltranslation/types';
>>>>>>> a/t

/**
 * Capitalizes the first letter of a string if applicable.
 * For strings that do not use capitalization, it returns the string unchanged.
 * @param {string} str - The string to capitalize.
 * @returns {string} The string with the first letter capitalized if applicable.
 */
function capitalizeName(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + (str.length > 1 ? str.slice(1) : '');
<<<<<<< HEAD
=======
}

/**
 * Internal helper to convert deprecated customNames prop to the new customMapping format.
 * Used for backward compatibility with previous LocaleSelector API.
 * @param {object} customNames - Mapping of locale to display name.
 * @returns {CustomMapping | undefined} The converted mapping or undefined.
 * @internal
 */
function _convertCustomNamesToMapping(
  customNames?: { [key: string]: string } | undefined
): CustomMapping | undefined {
  if (!customNames) return undefined;
  const result: CustomMapping = {};
  for (const locale in customNames) {
    result[locale] = { name: customNames[locale] };
  }
  return result;
>>>>>>> a/t
}

/**
 * A dropdown component that allows users to select a locale.
 * @param {string[]} [locales] - An optional list of locales to use for the dropdown. If not provided, the list of locales from the `<GTProvider>` context is used.
 * @param {object} [customNames] - (deprecated) An optional object to map locales to custom names. Use `customMapping` instead.
 * @param {CustomMapping} [customMapping] - An optional object to map locales to custom display names, emojis, or other properties.
 * @returns {React.ReactElement | null} The rendered locale dropdown component or null to prevent rendering.
 */
export default function LocaleSelector({
  locales: _locales,
  customNames,
  customMapping = _convertCustomNamesToMapping(customNames),
  ...props
}: {
  locales?: string[];
  customNames?: { [key: string]: string };
  customMapping?: CustomMapping;
  [key: string]: any;
}): React.JSX.Element | null {
  // Get locale selector properties
  const { locale, locales, setLocale, getLocaleProperties } = useLocaleSelector(
    _locales ? _locales : undefined
  );

  // Get display name
  const getDisplayName = (locale: string) => {
    if (customMapping && customMapping[locale]) {
      if (typeof customMapping[locale] === 'string')
        return customMapping[locale];
      if (customMapping[locale].name) return customMapping[locale].name;
    }
    return capitalizeName(getLocaleProperties(locale).nativeNameWithRegionCode);
  };

  // If no locales are returned, just render nothing or handle gracefully
  if (!locales || locales.length === 0 || !setLocale) {
    return null;
  }

  return (
    <select
      {...props}
      // Fallback to an empty string if currentLocale is undefined
      value={locale || ''}
      onChange={(e) => setLocale(e.target.value)}
    >
      {/* Optional fallback for when no locale is set */}
      {!locale && <option value='' />}

      {locales.map((locale) => (
        <option key={locale} value={locale} suppressHydrationWarning>
          {getDisplayName(locale)}
        </option>
      ))}
    </select>
  );
}
