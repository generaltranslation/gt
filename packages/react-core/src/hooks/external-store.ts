import { useSyncExternalStore } from 'react';
import { getI18nConfig, getTranslateListenerKey } from 'gt-i18n/internal';
import type { Translation } from 'gt-i18n/types';
import type { TranslateLookup, TranslateSnapshot } from '../i18n-cache/types';
import { getReactI18nCache } from '../i18n-cache/singleton-operations';
import { getTranslationSnapshot } from '../i18n-cache/snapshots';
import { useTranslationsSnapshot } from '../context/context';
import { useHandleMissingTranslation } from './utils/missing-translation';

/**
 * @internal
 */
export function useTranslate<T extends Translation>(
  lookup: TranslateLookup<T>
): TranslateSnapshot<T> {
  const i18nCache = getReactI18nCache();
  const translationsSnapshot = useTranslationsSnapshot();
  const onMissingTranslation = useHandleMissingTranslation();
  const lookupKey = getTranslateListenerKey(lookup);

  const storeTranslation = useSyncExternalStore(
    (listener) =>
      i18nCache.subscribe((event) => {
        if (
          event.type === 'translation' &&
          getTranslateListenerKey(event) === lookupKey
        ) {
          listener();
        }
      }),
    () => getTranslationSnapshot(i18nCache, translationsSnapshot, lookup),
    () => getTranslationSnapshot(i18nCache, translationsSnapshot, lookup)
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
