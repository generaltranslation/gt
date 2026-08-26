import {
  getReactI18nCache,
  isReactI18nCacheInitialized,
} from '@generaltranslation/react-core/pure';
import type { SharedGTProviderProps } from './GTProviderProps';

export function syncI18nCache({
  translations,
  dictionaries,
}: Pick<SharedGTProviderProps, 'translations' | 'dictionaries'>): void {
  if (!isReactI18nCacheInitialized()) return;

  const i18nCache = getReactI18nCache();
  i18nCache.updateTranslations(translations);
  i18nCache.updateDictionaries(dictionaries ?? {});
}
