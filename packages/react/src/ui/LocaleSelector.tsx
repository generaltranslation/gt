import React from 'react';
import useLocale from '../hooks/useLocale';
import useLocales from '../hooks/useLocales';
import { getLocaleProperties } from 'generaltranslation';
import useSetLocale from '../hooks/useSetLocale';

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
 * @param {string[]} locales - The list of supported locales. By default this is the user's list of supported locales from the `<GTProvider>` context.
 * @returns {React.ReactElement | null} The rendered locale dropdown component or null to prevent rendering.
 */
export default function LocaleSelector({
  locales = useLocales(),
  ...props
}: {
  locales?: string[];
}): React.ReactElement | null {
  // Retrieve the locale, locales, and setLocale function
  const locale = useLocale();
  const setLocale = useSetLocale();

  // If no locales are returned, just render nothing or handle gracefully
  if (!locales || locales.length === 0 || !setLocale) {
    return null;
  }

  // Sort locales
  // TODO: circle back to this
  locales.sort((a, b) =>
    new Intl.Collator('en-US').compare(
      getLocaleProperties(a).nativeNameWithRegionCode,
      getLocaleProperties(b).nativeNameWithRegionCode
    )
  );

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
          {capitalizeLanguageName(
            getLocaleProperties(locale).nativeNameWithRegionCode
          )}
        </option>
      ))}
    </select>
  );
}
