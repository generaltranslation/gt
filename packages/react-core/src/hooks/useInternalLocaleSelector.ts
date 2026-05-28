import { useCallback, useMemo } from 'react';
import { useCustomMapping, useLocales } from './i18n-config';
import { useLocale } from './condition-store';
import { getLocaleProperties } from 'generaltranslation';

export function useInternalLocaleSelector(locales?: string[]) {
  // Retrieve the locale, locales, and setLocale function
  const contextLocales = useLocales();
  const customMapping = useCustomMapping();
  const locale = useLocale();

  // sort
  const sortedLocales = useMemo(() => {
    if (!contextLocales || contextLocales.length === 0) {
      return [];
    }
    const collator = new Intl.Collator();
    return [...contextLocales].sort((a, b) =>
      collator.compare(
        getLocaleProperties(a, locale, customMapping).nativeNameWithRegionCode,
        getLocaleProperties(b, locale, customMapping).nativeNameWithRegionCode
      )
    );
  }, [contextLocales, locale, customMapping]);

  // create getLocaleProperties callback
  const getLocalePropertiesCallback = useCallback(
    (locale: string) => {
      return getLocaleProperties(locale, locale, customMapping);
    },
    [locale, customMapping]
  );

  return {
    locale,
    locales: locales ? locales : sortedLocales,
    getLocaleProperties: getLocalePropertiesCallback,
  };
}
