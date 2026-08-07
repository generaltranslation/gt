import type { LocaleProperties } from '@generaltranslation/format/types';
import { useMemo } from 'react';
import { useEnableI18n, useLocale } from './condition-store';
import { getFormatLocales } from './utils/getFormatLocales';
import { getI18nConfig } from 'gt-i18n/internal';

const EMPTY_LOCALES_PROP: string[] = [];

export { getFormatLocales };

export function useFormatLocales(
  localesProp: string[] = EMPTY_LOCALES_PROP
): string[] {
  const locale = useLocale();
  const enableI18n = useEnableI18n();
  return useMemo(
    () =>
      getFormatLocales({
        locale,
        enableI18n,
        localesProp,
      }),
    [locale, enableI18n, localesProp]
  );
}

export function useShouldTranslate(): boolean {
  const enableI18n = useEnableI18n();
  const locale = useLocale();
  return enableI18n && getI18nConfig().requiresTranslation(locale);
}

export function useLocaleProperties(locale: string): LocaleProperties {
  return useMemo(() => getI18nConfig().getLocaleProperties(locale), [locale]);
}

export function useLocaleDirection(locale?: string): 'ltr' | 'rtl' {
  const currentLocale = useLocale();
  const resolvedLocale = locale ?? currentLocale;
  return useMemo(
    () => getI18nConfig().getLocaleDirection(resolvedLocale),
    [resolvedLocale]
  );
}
