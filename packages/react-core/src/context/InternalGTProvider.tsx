import { useEffect, useMemo, type ReactNode } from 'react';
import type { Dictionary, Translation } from 'gt-i18n/types';
import type {
  Locale,
  Hash,
  WritableConditionStoreInterface,
} from 'gt-i18n/internal/types';
import { getGTContext } from './context';
import { getReactI18nCache } from '../i18n-cache/singleton-operations';
import type { I18nStore } from '../i18n-store/I18nStore';
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
  // Declared upstream dependent on environment
  conditionStore: WritableConditionStoreInterface;
  /** @deprecated Runtime translation state now lives in `ReactI18nCache`. */
  i18nStore?: I18nStore;
  onMissingTranslation?: OnMissingTranslation;
  onMissingDictionaryEntry?: OnMissingDictionaryEntry;
  onMissingDictionaryObj?: OnMissingDictionaryObj;
  resolveMissingDuringRender?: boolean;
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
  conditionStore,
  i18nStore,
  onMissingTranslation,
  onMissingDictionaryEntry,
  onMissingDictionaryObj,
  resolveMissingDuringRender = false,
}: InternalGTProviderProps) {
  const value = useMemo(
    () => ({
      translationsSnapshot: translations,
      dictionariesSnapshot: dictionaries ?? {},
      conditionStore,
      onMissingTranslation,
      onMissingDictionaryEntry,
      onMissingDictionaryObj,
      resolveMissingDuringRender,
    }),
    [
      translations,
      dictionaries,
      conditionStore,
      onMissingTranslation,
      onMissingDictionaryEntry,
      onMissingDictionaryObj,
      resolveMissingDuringRender,
    ]
  );

  // Update cache with data from server, do not emit events
  useEffect(() => {
    const target = i18nStore ?? getReactI18nCache();
    target.updateTranslations(translations);
    target.updateDictionaries(dictionaries ?? {});
  }, [translations, dictionaries, i18nStore]);

  return <GTContext.Provider value={value}>{children}</GTContext.Provider>;
}
