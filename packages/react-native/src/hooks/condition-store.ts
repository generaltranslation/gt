import { useCallback } from 'react';
import { getReadonlyConditionStoreWithFallback } from '@generaltranslation/react-core/context';

/**
 * Returns a function that sets the locale and reloads the configured runtime.
 */
export function useSetLocale() {
  return useCallback((locale: string) => {
    getReadonlyConditionStoreWithFallback().setLocale(locale);
  }, []);
}

/**
 * Returns a function that sets the enableI18n flag and reloads the configured runtime.
 */
export function useSetEnableI18n() {
  return useCallback((enableI18n: boolean) => {
    getReadonlyConditionStoreWithFallback().setEnableI18n(enableI18n);
  }, []);
}
