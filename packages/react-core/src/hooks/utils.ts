import { useMemo } from 'react';
import { useEnableI18n, useLocale } from './condition-store';
import { getFormatLocales } from './utils/getFormatLocales';
import { getI18nConfig } from 'gt-i18n/internal';
import { LocaleProperties } from '@generaltranslation/format/types';

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

export function useGTClass() {
  return useMemo(() => getI18nConfig().getGTClass(), []);
}

export function useLocaleProperties(locale: string): LocaleProperties {
  return useMemo(
    () => getI18nConfig().getGTClass().getLocaleProperties(locale),
    [locale]
  );
}

export function useLocaleDirection(locale: string) {
  return useMemo(
    () => getI18nConfig().getGTClass().getLocaleDirection(locale),
    [locale]
  );
}

export function useVersionId() {
  throw new Error('useVersionId unimplemented');
}
