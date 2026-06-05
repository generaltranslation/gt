import { useMemo } from 'react';
import { useEnableI18n, useLocale } from './condition-store';
import { getI18nConfig } from 'gt-i18n/internal';
import { getFormatLocales } from './format-locales';
import { getShouldTranslate } from './should-translate';

export function useFormatLocales(localesProp: string[] = []): string[] {
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

export { getFormatLocales, getShouldTranslate };
