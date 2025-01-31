import React from 'react';
import T from '../inline/T';
import useSetLocale from '../hooks/useSetLocale';
import useLocale from '../hooks/useLocale';
import useLocales from '../hooks/useLocales';
import { getLocaleProperties } from 'generaltranslation';

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
 * @returns {React.ReactElement | null} The rendered locale dropdown component or null to prevent rendering.
 */
export default function LocaleSelector(): React.ReactElement | null {
  // Retrieve the locale, locales, and setLocale function
  const locale = useLocale();
  const setLocale = useSetLocale();
  const locales = useLocales();

  // If no locales are returned, just render nothing or handle gracefully
  if (!locales || locales.length === 0 || !setLocale) {
    return null;
  }

  return (
    <GTSelect
      // Fallback to an empty string if currentLocale is undefined
      value={locale || ''}
      onChange={(e) => setLocale(e.target.value)}
    >
      {/* Optional fallback for when no locale is set */}
      {!locale && <GTOption value='' />}

      {locales.map((locale) => (
        <GTOption key={locale} value={locale}>
          {capitalizeLanguageName(
            getLocaleProperties(locale).nativeNameWithRegionCode
          )}
        </GTOption>
      ))}
    </GTSelect>
  );
}

/**
 * A dropdown component that allows users to select a locale.
 * @props {React.PropsWithChildren<React.JSX.IntrinsicElements['select']>} Properties passed to a <select> element.
 * @children {React.ReactNode} The children of the <select> element.
 * @returns {React.ReactElement} The rendered <select> element.
 */
export function GTSelect({
  children,
  ...props
}: React.PropsWithChildren<
  React.JSX.IntrinsicElements['select']
>): React.ReactElement {
  return <select {...props}>{children}</select>;
}

/**
 * A dropdown component that allows users to select a locale.
 * @props {React.PropsWithChildren<React.JSX.IntrinsicElements['option']>} Properties passed to an <option> element.
 * @children {React.ReactNode} The children of the <option> element.
 * @returns {React.ReactElement} The rendered <option> element.
 */
export function GTOption({
  children,
  ...props
}: React.PropsWithChildren<
  React.JSX.IntrinsicElements['option']
>): React.ReactElement {
  return <option {...props}>{children}</option>;
}
