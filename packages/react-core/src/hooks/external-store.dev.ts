import { useSyncExternalStore } from 'react';
import { getI18nConfig } from 'gt-i18n/internal';
import type { Translation } from 'gt-i18n/types';
import type {
  TranslateLookup,
  TranslateSnapshot,
} from '../i18n-store/storeTypes';
import { useTranslationsSnapshot } from '../context/useSnapshots';
import { useI18nStore } from '../i18n-store/useI18nStore';
import { useHandleMissingTranslation } from './utils/missing-translation';

export function useTranslateDev<T extends Translation>(
  lookup: TranslateLookup<T>
): TranslateSnapshot<T> {
  const i18nStore = useI18nStore();
  const translationsSnapshot = useTranslationsSnapshot();
  const onMissingTranslation = useHandleMissingTranslation();
  const storeTranslation = useSyncExternalStore(
    (listener) => i18nStore.subscribeToTranslate(lookup, listener),
    () => i18nStore.getTranslateSnapshot(lookup, translationsSnapshot),
    () => i18nStore.getTranslateSnapshot(lookup, translationsSnapshot)
  );

  if (storeTranslation == null && getI18nConfig().isDevHotReloadEnabled()) {
    onMissingTranslation(lookup);
  }

  return storeTranslation;
}
