import { getReadonlyConditionStoreWithFallback } from '../condition-store/singleton-operations';

/**
 * NOTE: useSetLocale() and useSetEnableI18n() are not implemented in @generaltranslation/react-core
 * Some server environments are read only, so we cannot implement these hooks.
 */

/**
 * Returns the current locale.
 */
export function useLocale(): string {
  return getReadonlyConditionStoreWithFallback().getLocale();
}

/**
 * Returns the current enableI18n flag.
 */
export function useEnableI18n(): boolean {
  return getReadonlyConditionStoreWithFallback().getEnableI18n();
}
