import React, { useMemo } from 'react';
import { CustomMapping } from 'generaltranslation/types';
import { InternalLocaleSelector } from '../../shared/InternalLocaleSelector';
import { getBrowserI18nManager } from '../setup/singleton-operations';

/**
 * A dropdown component that allows users to select a locale.
 * @param {string[]} [locales] - An optional list of locales to use for the dropdown. If not provided, the list of locales from the `<GTProvider>` context is used.
 * @param {object} [customNames] - (deprecated) An optional object to map locales to custom names. Use `customMapping` instead.
 * @param {CustomMapping} [customMapping] - An optional object to map locales to custom display names, emojis, or other properties.
 * @returns {React.ReactElement | null} The rendered locale dropdown component or null to prevent rendering.
 */
export function LocaleSelector({
  locales,
  ...props
}: {
  locales?: string[];
  customNames?: { [key: string]: string };
  customMapping?: CustomMapping;
  [key: string]: any;
}): React.JSX.Element | null {
  // Get the sorted locales, setLocale, and locale
  const { sortedLocales, setLocale, locale, getLocaleProperties } =
    useMemo(() => {
      const i18nManager = getBrowserI18nManager();
      const gt = i18nManager.getGTClass();
      const setLocale = i18nManager.setLocale;
      const locale = i18nManager.getLocale();
      const getLocaleProperties = (locale: string) => {
        return gt.getLocaleProperties(locale);
      };
      if (locales)
        return {
          locale,
          sortedLocales: locales,
          setLocale,
          getLocaleProperties,
        };
      const sortedLocales = i18nManager
        .getLocales()
        .sort((a, b) =>
          new Intl.Collator().compare(
            gt.getLocaleProperties(a).nativeNameWithRegionCode,
            gt.getLocaleProperties(b).nativeNameWithRegionCode
          )
        );
      return { locale, sortedLocales, setLocale, getLocaleProperties };
    }, [locales]);

  return (
    <InternalLocaleSelector
      locale={locale}
      locales={sortedLocales}
      setLocale={setLocale}
      getLocaleProperties={getLocaleProperties}
      {...props}
    />
  );
}
