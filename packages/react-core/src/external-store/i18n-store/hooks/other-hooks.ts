import { useSyncExternalStore } from 'react';
import { getI18nExternalStore } from '../external-store/singleton-operations';
import type { CustomMapping } from 'generaltranslation/types';

export function useCustomMapping(): CustomMapping {
  const store = getI18nExternalStore();
  return useSyncExternalStore(
    store.subscribeToCustomMapping,
    store.getCustomMappingSnapshot,
    store.getCustomMappingSnapshot
  );
}

export function useEnableI18n(): boolean {
  const store = getI18nExternalStore();
  return useSyncExternalStore(
    store.subscribeToEnableI18n,
    store.getEnableI18nSnapshot,
    store.getEnableI18nSnapshot
  );
}
