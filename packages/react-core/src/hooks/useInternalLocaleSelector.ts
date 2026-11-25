import { useCallback, useMemo } from 'react';
import type { LocaleProperties } from '@generaltranslation/format';
import { getI18nConfig } from 'gt-i18n/internal';
import { useLocales } from './i18n-config';
import { useLocale } from './condition-store';

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
  const locale = useLocale();

  // sort
  const sortedLocales = useMemo(() => {
    if (!contextLocales || contextLocales.length === 0) {
      return [];
    }
    const i18nConfig = getI18nConfig();
    const collator = new Intl.Collator();
    return [...contextLocales].sort((a, b) =>
      collator.compare(
        i18nConfig.getLocaleProperties(a, { locale }).nativeNameWithRegionCode,
        i18nConfig.getLocaleProperties(b, { locale }).nativeNameWithRegionCode
      )
    );
  }, [contextLocales, locale]);

  // create getLocaleProperties callback
  const getLocalePropertiesCallback = useCallback(
    (locale: string) => {
      return getI18nConfig().getLocaleProperties(locale, { locale });
    },
    [locale]
  );

  return {
    locale,
    locales: locales ? locales : sortedLocales,
    getLocaleProperties: getLocalePropertiesCallback,
  };
}
