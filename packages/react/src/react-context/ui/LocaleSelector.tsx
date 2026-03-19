import React from 'react';
import { useLocaleSelector } from '@generaltranslation/react-core';
import { CustomMapping } from 'generaltranslation/types';
import { InternalLocaleSelector } from '../../shared/InternalLocaleSelector';

/**
 * A dropdown component that allows users to select a locale.
 * @param {string[]} [locales] - An optional list of locales to use for the dropdown. If not provided, the list of locales from the `<GTProvider>` context is used.
 * @param {object} [customNames] - (deprecated) An optional object to map locales to custom names. Use `customMapping` instead.
 * @param {CustomMapping} [customMapping] - An optional object to map locales to custom display names, emojis, or other properties.
 * @returns {React.ReactElement | null} The rendered locale dropdown component or null to prevent rendering.
 */
export default function LocaleSelector({
  locales: _locales,
  ...props
}: {
  locales?: string[];
  customNames?: { [key: string]: string };
  customMapping?: CustomMapping;
  [key: string]: any;
}): React.JSX.Element | null {
  // Get locale selector properties
  const { locale, locales, setLocale, getLocaleProperties } =
    useLocaleSelector(_locales);

  return (
    <InternalLocaleSelector
      locale={locale}
      locales={locales}
      setLocale={setLocale}
      getLocaleProperties={getLocaleProperties}
      {...props}
    />
  );
}
