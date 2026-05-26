import { useCallback } from 'react';
import { getBrowserConditionStore } from '../condition-store/singleton-operations';

/**
 * Returns a function that sets the locale
 */
export function useSetLocale() {
  return useCallback((locale: string) => {
    const conditionStore = getBrowserConditionStore();
    conditionStore.setLocale(locale);
  }, []);
}

/**
 * Returns a function that sets the enableI18n flag in the condition store.
 */
export function useSetEnableI18n() {
  return useCallback((enableI18n: boolean) => {
    const conditionStore = getBrowserConditionStore();
    conditionStore.setEnableI18n(enableI18n);
  }, []);
}
