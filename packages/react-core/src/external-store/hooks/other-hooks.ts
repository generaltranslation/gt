import { useSyncExternalStore } from 'react';
import { useI18nExternalStore } from '../provider/GTContext';
import type { CustomMapping } from 'generaltranslation/types';

export function useCustomMapping(): CustomMapping {
  const store = useI18nExternalStore();
  return useSyncExternalStore(
    store.subscribeToCustomMapping,
    store.getCustomMappingSnapshot,
    store.getCustomMappingSnapshot
  );
}

export function useEnableI18n(): boolean {
  const store = useI18nExternalStore();
  return useSyncExternalStore(
    store.subscribeToEnableI18n,
    store.getEnableI18nSnapshot,
    store.getEnableI18nSnapshot
  );
}
