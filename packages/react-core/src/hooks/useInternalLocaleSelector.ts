import { useCallback, useMemo } from 'react';
import { useLocale } from './condition-store';
import { getLocaleProperties } from 'generaltranslation';
import { getI18nConfig } from 'gt-i18n/internal';

export function useInternalLocaleSelector(locales?: string[]) {
  // Retrieve the locale, locales, and setLocale function
  const i18nConfig = getI18nConfig();
  const contextLocales = i18nConfig.getLocales();
  const customMapping = i18nConfig.getCustomMapping();
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
