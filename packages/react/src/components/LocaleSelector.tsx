import type React from 'react';
import { InternalLocaleSelector } from '@generaltranslation/react-core/components';
import { CustomMapping } from 'generaltranslation/types';
import { useLocaleSelector } from './useLocaleSelector';

/**
 * A dropdown component that allows users to select a locale.
 * @param {string[]} [locales] - An optional list of locales to use for the dropdown. If not provided, the list of locales from the `<GTProvider>` context is used.
 * @param {object} [customNames] - (deprecated) An optional object to map locales to custom names. Use `customMapping` instead.
 * @param {CustomMapping} [customMapping] - An optional object to map locales to custom display names, emojis, or other properties.
 * @returns {React.ReactElement | null} The rendered locale dropdown component or null to prevent rendering.
 */
export function LocaleSelector({
  locales: _locales,
  ...props
}: LocaleSelectorProps): React.JSX.Element | null {
  // Get locale selector properties
  const { locale, locales, getLocaleProperties, setLocale } =
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

export type LocaleSelectorProps = {
  locales?: string[];
  customNames?: { [key: string]: string };
  customMapping?: CustomMapping;
  [key: string]: any;
};
