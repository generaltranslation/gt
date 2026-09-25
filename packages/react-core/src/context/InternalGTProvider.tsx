import { useEffect, useMemo, type ReactNode } from 'react';
import { I18nStore } from '../i18n-store/I18nStore';
import type { Dictionary, Translation } from 'gt-i18n/types';
import type { Locale, Hash } from 'gt-i18n/internal/types';
import { getGTContext } from './context';
import type {
  OnMissingDictionaryEntry,
  OnMissingDictionaryObj,
  OnMissingTranslation,
} from '../hooks/utils/missing-translation';

export type InternalGTProviderProps = {
  children?: ReactNode;
  // For streaming translations to server
  translations: Record<Locale, Record<Hash, Translation>>;
  dictionaries?: Record<Locale, Dictionary>;
  locale: string;
  region: string | undefined;
  enableI18n: boolean;
  setLocale: (locale: string) => void;
  setRegion: (region: string | undefined) => void;
  setEnableI18n: (enabled: boolean) => void;
  i18nStore: I18nStore;
  // Custom override missing translation behavior for dev hot reload
  onMissingTranslation?: OnMissingTranslation;
  onMissingDictionaryEntry?: OnMissingDictionaryEntry;
  onMissingDictionaryObj?: OnMissingDictionaryObj;
};

// ===== Component ===== //
const GTContext = getGTContext();
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
  locale,
  region,
  enableI18n,
  setLocale,
  setRegion,
  setEnableI18n,
  i18nStore,
  onMissingTranslation,
  onMissingDictionaryEntry,
  onMissingDictionaryObj,
}: InternalGTProviderProps) {
  const value = useMemo(
    () => ({
      translationsSnapshot: translations,
      dictionariesSnapshot: dictionaries ?? {},
      i18nStore,
      locale,
      region,
      enableI18n,
      setLocale,
      setRegion,
      setEnableI18n,
      onMissingTranslation,
      onMissingDictionaryEntry,
      onMissingDictionaryObj,
    }),
    [
      translations,
      dictionaries,
      i18nStore,
      locale,
      region,
      enableI18n,
      setLocale,
      setRegion,
      setEnableI18n,
      onMissingTranslation,
      onMissingDictionaryEntry,
      onMissingDictionaryObj,
    ]
  );

  // Update cache with data from server, do not emit events
  useEffect(() => {
    i18nStore.updateTranslations(translations);
    i18nStore.updateDictionaries(dictionaries ?? {});
  }, [translations, dictionaries, i18nStore]);

  return <GTContext.Provider value={value}>{children}</GTContext.Provider>;
}
