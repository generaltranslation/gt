import { useDefaultLocale } from "./external-store-hooks";
import { useLocale } from "./condition-store";
import { requiresTranslation } from "generaltranslation/core";
import { getReadonlyConditionStoreWithFallback } from "../condition-store/singleton-operations";
import { getReactI18nManager } from "../i18n-manager/singleton-operations";

export function useFormatLocales(localesProp: string[] = []): string[] {
  const locale = useLocale();
  const defaultLocale = useDefaultLocale();
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
  const i18nManager = getReactI18nManager();

  const enableI18n = conditionStore.getEnableI18n();
  const locale = conditionStore.getLocale();
  const defaultLocale = i18nManager.getDefaultLocale();
  const locales = i18nManager.getLocales();
  const customMapping = i18nManager.getCustomMapping();
  return (
    enableI18n &&
    requiresTranslation(defaultLocale, locale, [...locales], customMapping)
  );
}
