import {
  Dictionary,
  Hash,
  Locale,
  ReadonlyConditionStoreInterface,
} from 'gt-i18n/internal/types';
import { Translation } from 'gt-i18n/types';
import { createContext, useContext } from 'react';
import { I18nStore } from '../i18n-store/I18nStore';
import { getI18nStore } from '../i18n-store/singleton-operations';
import { getRenderStrategy } from '../setup/globals';
import { getReadonlyConditionStore } from '../condition-store/singleton-operations';

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
};

export const GTContext = createContext<GTContextType | undefined>(undefined);

export function useGTContext(): GTContextType {
  const context = useContext(GTContext);
  if (!context) {
    if (getRenderStrategy() === 'SPA') {
      return {
        translationsSnapshot: {},
        dictionariesSnapshot: {},
        i18nStore: getI18nStore(),
        conditionStore: getReadonlyConditionStore(),
      };
    } else {
      // TODO: softer error behavior
      // This can also happen in monorepo if you have two different versions of @generaltranslation/react-core
      // make sure to use the same version of @generaltranslation/react-core in all packages
      throw new Error('useGTContext must be used within a GTProvider');
    }
  }
  return context;
}
