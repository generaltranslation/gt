import { useLocale } from './condition-store';
import { getReadonlyConditionStoreWithFallback } from '../condition-store/singleton-operations';
import { getI18nConfig } from 'gt-i18n/internal';

export function useFormatLocales(localesProp: string[] = []): string[] {
  const locale = useLocale();
  const defaultLocale = getI18nConfig().getDefaultLocale();
  const shouldTranslate = useShouldTranslate();
  return shouldTranslate
    ? [...localesProp, locale, defaultLocale]
    : [defaultLocale];
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
