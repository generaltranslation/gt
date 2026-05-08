import { useSyncExternalStore } from 'react';
import { useI18nExternalStore } from '../provider/GTContext';

export function useLocale(): string {
  const store = useI18nExternalStore();
  return useSyncExternalStore(
    store.subscribeToLocale,
    store.getLocaleSnapshot,
    store.getLocaleSnapshot
  );
}

export function useRegion(): string | undefined {
  const store = useI18nExternalStore();
  return useSyncExternalStore(
    store.subscribeToRegion,
    store.getRegionSnapshot,
    store.getRegionSnapshot
  );
}

export function useSetLocale(): (locale: string) => void {
  return useI18nExternalStore().setLocale;
}

export function useSetRegion(): (region: string | undefined) => void {
  return useI18nExternalStore().setRegion;
}

export function useDefaultLocale(): string {
  const store = useI18nExternalStore();
  return useSyncExternalStore(
    store.subscribeToDefaultLocale,
    store.getDefaultLocaleSnapshot,
    store.getDefaultLocaleSnapshot
  );
}

export function useLocales(): readonly string[] {
  const store = useI18nExternalStore();
  return useSyncExternalStore(
    store.subscribeToLocales,
    store.getLocalesSnapshot,
    store.getLocalesSnapshot
  );
}
