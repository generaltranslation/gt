import { useCallback, useMemo } from 'react';
import type { LocaleProperties } from '@generaltranslation/format/types';
import { useCustomMapping, useLocales } from './i18n-config';
import { useLocale } from './condition-store';
import { getLocaleProperties } from '@generaltranslation/format';

// Explicit return type so the inferred type stays portable for downstream
// packages (e.g. gt-react-native), otherwise the getLocaleProperties callback
// pulls in generaltranslation's bundled, non-nameable type (TS2742).
export type InternalLocaleSelectorResult = {
  locale: string;
  locales: string[];
  getLocaleProperties: (locale: string) => LocaleProperties;
};

export function useInternalLocaleSelector(
  locales?: string[]
): InternalLocaleSelectorResult {
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
