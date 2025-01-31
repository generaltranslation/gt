import React from 'react';
import T from '../inline/T';
import useSetLocale from '../hooks/useSetLocale';
import useLocale from '../hooks/useLocale';
import useLocales from '../hooks/useLocales';
import { getLocaleName } from 'generaltranslation';
/**
 * A dropdown component that allows users to select a locale.
 * @returns {React.ReactElement | null} The rendered locale dropdown component or null to prevent rendering.
 */
export default function GTLocaleDropdown(): React.ReactElement | null {
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
      {!locale && (
        <GTOption value=''>
          <T id='_gt-internal-dropdown'>{'Select a Locale'}</T>
        </GTOption>
      )}

      {locales.map((locale) => (
        <GTOption key={locale} value={locale}>
          {getLocaleName(locale) || ''}
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
