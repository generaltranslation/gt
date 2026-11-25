import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { InternalLocaleSelector } from '@generaltranslation/react-core/components';
import { useLocaleSelector } from './useLocaleSelector';

/**
 * A dropdown component that allows users to select a locale.
 * @param {string[]} [locales] - An optional list of locales to use for the dropdown. If not provided, the list of locales from the `<GTProvider>` context is used.
 * @param {CustomMapping} [customMapping] - An optional object to map locales to custom display names, emojis, or other properties.
 * @returns {React.ReactElement | null} The rendered locale dropdown component or null to prevent rendering.
 */
export const LocaleSelector = forwardRef<
  HTMLSelectElement,
  LocaleSelectorProps
>(function LocaleSelector({ locales: _locales, ...props }, ref) {
  // Get locale selector properties
  const { locale, locales, getLocaleProperties, setLocale } =
    useLocaleSelector(_locales);

  return (
    <InternalLocaleSelector
      ref={ref}
      {...props}
      locale={locale}
      locales={locales}
      setLocale={setLocale}
      getLocaleProperties={getLocaleProperties}
    />
  );
});

export type LocaleSelectorProps = Omit<
  ComponentPropsWithoutRef<typeof InternalLocaleSelector>,
  'locale' | 'locales' | 'setLocale' | 'getLocaleProperties'
> & {
  locales?: string[];
};
