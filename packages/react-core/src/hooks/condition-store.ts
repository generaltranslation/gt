import { ReadonlyConditionStoreInterface } from 'gt-i18n/internal/types';
import { getReadonlyConditionStoreWithFallback } from '../condition-store/singleton-operations';
import { useGTContext } from '../context/context';

/**
 * NOTE: useSetLocale() and useSetEnableI18n() are not implemented in @generaltranslation/react-core
 * Some server environments are read only, so we cannot implement these hooks.
 */

export function useConditionStore(): ReadonlyConditionStoreInterface {
  const context = useGTContext();
  return context?.conditionStore ?? getReadonlyConditionStoreWithFallback();
}

/**
 * Returns the current locale.
 */
export function useLocale(): string {
  return useConditionStore().getLocale();
}

/**
 * Returns the current enableI18n flag.
 */
export function useEnableI18n(): boolean {
  return useConditionStore().getEnableI18n();
}
