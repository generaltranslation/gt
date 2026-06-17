import { useSyncExternalStore } from 'react';
import type { Translation } from 'gt-i18n/types';
import type {
  TranslateLookup,
  TranslateSnapshot,
} from '../i18n-store/storeTypes';
import {
  useI18nStore,
  useTranslationsSnapshot,
} from '../i18n-store/useI18nStore';
import { getI18nConfig } from 'gt-i18n/internal';
import { useHandleMissingTranslation } from './utils/missing-translation';

/**
 * @internal
 */
export function useTranslate<T extends Translation>(
  lookup: TranslateLookup<T>
): TranslateSnapshot<T> {
  const i18nStore = useI18nStore();
  const translationsSnapshot = useTranslationsSnapshot();
  const onMissingTranslation = useHandleMissingTranslation();

  /**
   * TODO: for snapshot lookup, we can use the translation snapshot
   * to avoid the adapter.resolveTranslation call.
   */
  const storeTranslation = useSyncExternalStore(
    (listener) => i18nStore.subscribeToTranslate(lookup, listener),
    () => i18nStore.getTranslateSnapshot(lookup, translationsSnapshot),
    () => i18nStore.getTranslateSnapshot(lookup, translationsSnapshot)
  );

  if (storeTranslation == null && getI18nConfig().isDevHotReloadEnabled()) {
    // TODO: (separate PR): add configuration for a use() + suspense strategy
    // TODO: consider moving this to a useEffect
    onMissingTranslation(lookup);
  }

  return storeTranslation;
}
