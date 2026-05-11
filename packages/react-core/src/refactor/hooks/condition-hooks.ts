import { useSyncExternalStore } from 'react';
import { useConditionStore } from '../provider/GTContext';

export function useLocale(): string {
  const store = useConditionStore();
  return useSyncExternalStore(
    store.subscribeToLocale,
    store.getLocale,
    store.getLocale
  );
}

export function useRegion(): string | undefined {
  const store = useConditionStore();
  return useSyncExternalStore(
    store.subscribeToRegion,
    store.getRegion,
    store.getRegion
  );
}

export function useSetLocale(): (locale: string) => void {
  return useConditionStore().setLocale;
}

export function useSetRegion(): (region: string | undefined) => void {
  return useConditionStore().setRegion;
}
