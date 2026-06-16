import { useCallback } from 'react';
import { useConditionStore } from '@generaltranslation/react-core/hooks';

/**
 * Returns a function that sets the locale.
 */
export function useSetLocale() {
  const conditionStore = useConditionStore();
  return useCallback(
    (locale: string) => {
      conditionStore.setLocale(locale);
    },
    [conditionStore]
  );
}

/**
 * Returns a function that sets the region.
 */
export function useSetRegion() {
  const conditionStore = useConditionStore();
  return useCallback(
    (region: string | undefined) => {
      conditionStore.setRegion(region);
    },
    [conditionStore]
  );
}

/**
 * Returns a function that sets the enableI18n flag.
 */
export function useSetEnableI18n() {
  const conditionStore = useConditionStore();
  return useCallback(
    (enableI18n: boolean) => {
      conditionStore.setEnableI18n(enableI18n);
    },
    [conditionStore]
  );
}
