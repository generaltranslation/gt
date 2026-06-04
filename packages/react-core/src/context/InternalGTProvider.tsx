import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { I18nStore, type I18nStoreParams } from '../i18n-store/I18nStore';
import type { Dictionary, Translation } from 'gt-i18n/types';
import type { Locale, Hash } from 'gt-i18n/internal/types';
import { GTContext } from './context';
import type { ReadonlyConditionStore } from 'gt-i18n/internal';
import type {
  OnMissingDictionaryEntry,
  OnMissingDictionaryObj,
  OnMissingTranslation,
} from '../hooks/utils/missing-translation';

export type InternalGTProviderProps = I18nStoreParams & {
  children?: ReactNode;
  // For streaming translations to server
  translations: Record<Locale, Record<Hash, Translation>>;
  dictionaries?: Record<Locale, Dictionary>;
  // Declared upstream dependent on environment
  conditionStore: ReadonlyConditionStore;
  // Custom override missing translation behavior for dev hot reload
  onMissingTranslation?: OnMissingTranslation;
  onMissingDictionaryEntry?: OnMissingDictionaryEntry;
  onMissingDictionaryObj?: OnMissingDictionaryObj;
};

// ===== Component ===== //

/**
 * - Shared provider logic btwn client and server providers
 * - This is not userfacing, it should be wrapped in a userfacing provider with runtime-specific logic
 * - Locale and translations (and dictionaries if applicable) are required
 *
 * TODO: selectively filter to only pass new translations to client for dev hot reload
 * TODO: rename parent directory to "/provider" (separate PR)
 */
export function InternalGTProvider({
  children,
  translations,
  dictionaries,
  conditionStore,
  onMissingTranslation,
  onMissingDictionaryEntry,
  onMissingDictionaryObj,
}: InternalGTProviderProps) {
  const i18nStoreRef = useRef<I18nStore | null>(null);
  if (i18nStoreRef.current == null) {
    i18nStoreRef.current = new I18nStore({});
  }

  const value = useMemo(
    () => ({
      translationsSnapshot: translations,
      dictionariesSnapshot: dictionaries ?? {},
      i18nStore: i18nStoreRef.current!,
      conditionStore,
      onMissingTranslation,
      onMissingDictionaryEntry,
      onMissingDictionaryObj,
    }),
    [
      translations,
      dictionaries,
      i18nStoreRef.current,
      conditionStore,
      onMissingTranslation,
      onMissingDictionaryEntry,
      onMissingDictionaryObj,
    ]
  );

  // Update cache with data from server, do not emit events
  useEffect(() => {
    if (i18nStoreRef.current == null) return;
    i18nStoreRef.current.updateTranslations(translations);
    i18nStoreRef.current.updateDictionaries(dictionaries ?? {});
  }, [translations, dictionaries]);

  //

  return <GTContext.Provider value={value}>{children}</GTContext.Provider>;
}
