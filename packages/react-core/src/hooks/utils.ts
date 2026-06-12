import { useMemo } from 'react';
import { useEnableI18n, useLocale } from './condition-store';
import { getReadonlyConditionStoreWithFallback } from '../condition-store/singleton-operations';
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
