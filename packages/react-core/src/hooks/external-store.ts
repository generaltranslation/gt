import { useCallback, useSyncExternalStore } from 'react';
import type { Content } from '@generaltranslation/format';
import type {
  TranslateLookup,
  TranslateSnapshot,
} from '../i18n-store/storeTypes';
import {
  useI18nStore,
  useTranslationsSnapshot,
} from '../i18n-store/useI18nStore';
import {
  getI18nConfig,
  lookupInlineTranslation,
  type InlineTranslations,
} from 'gt-i18n/internal';
import { useHandleMissingTranslation } from './utils/missing-translation';

/**
 * @internal
 * @param inline - Translations embedded at the call site, which win over
 * loaded translations. Pass it only when the locale should be translated.
 */
export function useTranslate<T extends Content>(
  lookup: TranslateLookup<T>,
  inline?: InlineTranslations<T>
): TranslateSnapshot<T> {
  const i18nStore = useI18nStore();
  const translationsSnapshot = useTranslationsSnapshot();
  const onMissingTranslation = useHandleMissingTranslation();

  // React subscribes again whenever these change, so they change only with
  // the lookup.
  const { locale, content, options } = lookup;
  const subscribe = useCallback(
    (listener: () => void) =>
      i18nStore.subscribeToTranslate({ locale, content, options }, listener),
    [i18nStore, locale, content, options]
  );
  /**
   * TODO: for snapshot lookup, we can use the translation snapshot
   * to avoid the adapter.resolveTranslation call.
   */
  const getSnapshot = useCallback(
    () =>
      i18nStore.getTranslateSnapshot(
        { locale, content, options },
        translationsSnapshot
      ),
    [i18nStore, locale, content, options, translationsSnapshot]
  );
  const storeTranslation = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getSnapshot
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

  return (
    (inline && lookupInlineTranslation(inline, lookup.locale)) ??
    storeTranslation
  );
}
