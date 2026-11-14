import React from 'react';
import type {
  CustomMapping,
  LocaleProperties,
} from '@generaltranslation/format/types';

/**
 * Capitalizes the first letter of a string if applicable.
 * For strings that do not use capitalization, it returns the string unchanged.
 * @param {string} str - The string to capitalize.
 * @returns {string} The string with the first letter capitalized if applicable.
 */
function capitalizeName(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + (str.length > 1 ? str.slice(1) : '');
}

/**
 * A dropdown component that allows users to select a locale.
 * @param {string} locale - The currently selected locale.
 * @param {string[]} locales - The list of all available locales.
 * @param {function} setLocale - Function to update the current locale.
 * @param {function} getLocaleProperties - Function to retrieve properties for a given locale.
 * @param {CustomMapping} [customMapping] - An optional object to map locales to custom display names, emojis, or other properties.
 * @returns {React.ReactElement | null} The rendered locale dropdown component or null to prevent rendering.
 *
 * @internal
 */
export function InternalLocaleSelector({
  locale,
  locales,
  customMapping,
  setLocale,
  getLocaleProperties,
  ...props
}: {
  locale: string;
  locales: string[];
  customMapping?: CustomMapping;
  setLocale: (locale: string) => void;
  getLocaleProperties: (locale: string) => LocaleProperties;
  [key: string]: any;
}): React.JSX.Element | null {
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
      name='generaltranslation-locale'
      aria-label='General Translation locale selector'
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
