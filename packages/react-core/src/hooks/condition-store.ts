import { useCallback } from 'react';
import type { ReadonlyConditionStoreInterface } from 'gt-i18n/internal/types';
import { getReadonlyConditionStore } from '../condition-store/singleton-operations';
import { useGTContext } from '../context/context';
import { getI18nConfig } from 'gt-i18n/internal';

export function useConditionStore(): ReadonlyConditionStoreInterface {
  const context = useGTContext();
  return context?.conditionStore ?? getReadonlyConditionStore();
}

/**
 * Returns the current locale.
 */
export function useLocale(): string {
  return getI18nConfig().resolveAliasLocale(useConditionStore().getLocale());
}

/**
 * Returns the current region, or undefined if no region is set.
 */
export function useRegion(): string | undefined {
  return useConditionStore().getRegion();
}

/**
 * Returns the current enableI18n flag.
 */
export function useEnableI18n(): boolean {
  return useConditionStore().getEnableI18n();
}

export function useSetLocale(): (locale: string) => void {
  const conditionStore = useConditionStore();
  return useCallback(
    (locale: string) => conditionStore.setLocale(locale),
    [conditionStore]
  );
}

export function useSetRegion(): (region: string | undefined) => void {
  const conditionStore = useConditionStore();
  return useCallback(
    (region: string | undefined) => conditionStore.setRegion(region),
    [conditionStore]
  );
}

export function useSetEnableI18n(): (enabled: boolean) => void {
  const conditionStore = useConditionStore();
  return useCallback(
    (enabled: boolean) => conditionStore.setEnableI18n(enabled),
    [conditionStore]
  );
}
