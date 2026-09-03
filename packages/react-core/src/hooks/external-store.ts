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
import { lookupTranslation } from '../i18n-store/utils/translations';
import { getI18nConfig, getI18nRuntime } from 'gt-i18n/internal';
import { useHandleMissingTranslation } from './utils/missing-translation';
import { useGTContext } from '../context/context';

/**
 * @internal
 */
function useTranslateDev<T extends Translation>(
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

  if (
    process.env.NODE_ENV !== 'production' &&
    storeTranslation == null &&
    getI18nConfig().isDevHotReloadEnabled()
  ) {
    // TODO: (separate PR): add configuration for a use() + suspense strategy
    // TODO: consider moving this to a useEffect
    onMissingTranslation(lookup);
  }

  return storeTranslation;
}

function useTranslateProd<T extends Translation>(
  lookup: TranslateLookup<T>
): TranslateSnapshot<T> {
  const context = useGTContext();
  return context
    ? lookupTranslation(context.translationsSnapshot, lookup)
    : getI18nRuntime().lookupTranslation(
        lookup.locale,
        lookup.message,
        lookup.options
      );
}

export const useTranslate =
  process.env.NODE_ENV === 'production' ? useTranslateProd : useTranslateDev;
