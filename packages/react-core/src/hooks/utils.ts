import { useMemo } from 'react';
import { useEnableI18n, useLocale } from './condition-store';
import { getReadonlyConditionStoreWithFallback } from '../condition-store/singleton-operations';
import { getI18nConfig } from 'gt-i18n/internal';
import { useConditionAdapter } from '../condition-store/condition-adapter/useConditionAdapter';

const EMPTY_LOCALES_PROP: string[] = [];

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

export function getFormatLocales({
  locale,
  enableI18n,
  localesProp = EMPTY_LOCALES_PROP,
}: {
  locale: string;
  enableI18n: boolean;
  localesProp?: string[];
}): string[] {
  const defaultLocale = getI18nConfig().getDefaultLocale();
  const shouldTranslate =
    enableI18n && getI18nConfig().requiresTranslation(locale);
  return shouldTranslate
    ? [...localesProp, locale, defaultLocale]
    : [defaultLocale];
}

export function useShouldTranslate(): boolean {
  const conditionAdapter = useConditionAdapter();
  const enableI18n = conditionAdapter.getEnableI18n();
  const locale = conditionAdapter.getLocale();
  return enableI18n && getI18nConfig().requiresTranslation(locale);
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
