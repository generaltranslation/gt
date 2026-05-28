import { useMemo } from 'react';
import { useLocale } from './condition-store';
import { getReadonlyConditionStoreWithFallback } from '../condition-store/singleton-operations';
import { getI18nConfig } from 'gt-i18n/internal';

const EMPTY_LOCALES_PROP: string[] = [];

export function useFormatLocales(
  localesProp: string[] = EMPTY_LOCALES_PROP
): string[] {
  const locale = useLocale();
  const defaultLocale = getI18nConfig().getDefaultLocale();
  const shouldTranslate = getShouldTranslate();
  return useMemo(
    () =>
      shouldTranslate
        ? [...localesProp, locale, defaultLocale]
        : [defaultLocale],
    [defaultLocale, locale, localesProp, shouldTranslate]
  );
}

export function useShouldTranslate(): boolean {
  return getShouldTranslate();
}

/**
 * Returns true if (1) i18n enabled and (2) translation is required
 */
export function getShouldTranslate(): boolean {
  const conditionStore = getReadonlyConditionStoreWithFallback();
  const i18nConfig = getI18nConfig();

  const enableI18n = conditionStore.getEnableI18n();
  const locale = conditionStore.getLocale();
  return enableI18n && i18nConfig.requiresTranslation(locale);
}
