import { useSyncExternalStore } from 'react';
import { getI18nExternalStore } from '../external-store/singleton-operations';

export function useLocale(): string {
  const store = getI18nExternalStore();
  return useSyncExternalStore(
    store.subscribeToLocale,
    store.getLocaleSnapshot,
    store.getLocaleSnapshot
  );
}

export function useRegion(): string | undefined {
  const store = getI18nExternalStore();
  return useSyncExternalStore(
    store.subscribeToRegion,
    store.getRegionSnapshot,
    store.getRegionSnapshot
  );
}

export function useDefaultLocale(): string {
  const store = getI18nExternalStore();
  return useSyncExternalStore(
    store.subscribeToDefaultLocale,
    store.getDefaultLocaleSnapshot,
    store.getDefaultLocaleSnapshot
  );
}

export function useLocales(): readonly string[] {
  const store = getI18nExternalStore();
  return useSyncExternalStore(
    store.subscribeToLocales,
    store.getLocalesSnapshot,
    store.getLocalesSnapshot
  );
}
