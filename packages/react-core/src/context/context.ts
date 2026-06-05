import {
  Dictionary,
  Hash,
  Locale,
  ReadonlyConditionStoreInterface,
} from 'gt-i18n/internal/types';
import { Translation } from 'gt-i18n/types';
import { createContext, useContext } from 'react';
import { I18nStore } from '../i18n-store/I18nStore';
import { getI18nConfig } from '../setup/i18nConfig';
import type {
  OnMissingTranslation,
  OnMissingDictionaryEntry,
  OnMissingDictionaryObj,
} from '../hooks/utils/missing-translation';

export type GTContextType = {
  /**
   * Source of truth for translations, streamed from server
   * In SPA mode, these won't be accessible and translations
   * can be accessed via useSyncExternalStore() directly
   */
  translationsSnapshot: Record<Locale, Record<Hash, Translation>>;
  dictionariesSnapshot: Record<Locale, Dictionary>;
  /**
   * I18nStore allows us to sync state updates in ConditionStore and I18nCache
   * with renders
   */
  i18nStore: I18nStore;
  /**
   * ConditionStore should always remain separate from i18nStore as
   * it manages how we perform lookups
   */
  conditionStore: ReadonlyConditionStoreInterface;
  /**
   * Custom override behavior on missing translations
   * Used for server triggering tx hmr b/c no access to useEffect
   */
  onMissingTranslation?: OnMissingTranslation;
  onMissingDictionaryEntry?: OnMissingDictionaryEntry;
  onMissingDictionaryObj?: OnMissingDictionaryObj;
};

export const GTContext = createContext<GTContextType | undefined>(undefined);

export function useGTContext(): GTContextType | undefined {
  const context = useContext(GTContext);
  if (context || getI18nConfig().getRenderStrategy() === 'SPA') {
    return context;
  }
  /**
   * TODO: in a separate PR, we should figure out how to make this more of a forgiving system
   */
  throw new Error('GTContext must be read within a GTProvider');
}
