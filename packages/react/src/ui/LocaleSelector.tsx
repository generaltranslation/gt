import React from 'react';
import useLocaleSelector from '../hooks/useLocaleSelector';

/**
 * Capitalizes the first letter of a language name if applicable.
 * For languages that do not use capitalization, it returns the name unchanged.
 * @param {string} language - The name of the language.
 * @returns {string} The language name with the first letter capitalized if applicable.
 */
function capitalizeLanguageName(language: string): string {
  if (!language) return '';
  return (
    language.charAt(0).toUpperCase() +
    (language.length > 1 ? language.slice(1) : '')
  );
}

/**
 * A dropdown component that allows users to select a locale.
 * @param {string[]} locales - An optional list of locales to use for the dropdown. If not provided, the list of locales from the `<GTProvider>` context is used.
 * @param {object} customNames - An optional object to map locales to custom names.
 * @returns {React.ReactElement | null} The rendered locale dropdown component or null to prevent rendering.
 */
export default function LocaleSelector({
  locales: _locales,
  customNames,
  ...props
}: {
  locales?: string[];
  customNames?: { [key: string]: string };
  [key: string]: any;
}): React.JSX.Element | null {
  // Get locale selector properties
  const { locale, locales, setLocale, getLocaleProperties } = useLocaleSelector(
    _locales ? _locales : undefined
  );

  // Get display name
  const getDisplayName = (locale: string) => {
    if (customNames && customNames[locale]) {
      return customNames[locale];
    }
    return capitalizeLanguageName(
      getLocaleProperties(locale).nativeNameWithRegionCode
    );
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
