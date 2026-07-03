import {
  useCustomMapping,
  useDefaultLocale,
  useLocales,
} from './external-store-hooks';
import { useEnableI18n, useLocale } from './context-hooks';
import { requiresTranslation } from 'generaltranslation/core';

export function useFormatLocales(localesProp: string[] = []): string[] {
  const locale = useLocale();
  const defaultLocale = useDefaultLocale();
  const shouldTranslate = useShouldTranslate();
  return shouldTranslate
    ? [...localesProp, locale, defaultLocale]
    : [defaultLocale];
}

/**
 * Returns true if (1) i18n enabled and (2) translation is required
 */
export function useShouldTranslate(): boolean {
  const enableI18n = useEnableI18n();
  const defaultLocale = useDefaultLocale();
  const locale = useLocale();
  const locales = useLocales();
  const customMapping = useCustomMapping();
  return (
    enableI18n &&
    requiresTranslation(defaultLocale, locale, [...locales], customMapping)
  );
}
