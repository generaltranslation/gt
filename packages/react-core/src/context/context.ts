import { Dictionary, Hash, Locale } from "gt-i18n/internal/types";
import { Translation } from "gt-i18n/types";
import { createContext, useContext } from "react";
import { I18nStore } from "../i18n-store/I18nStore";

export type GTContextType = {
  /**
   * Source of truth for translations, streamed from server
   */
  translationsSnapshot: Record<Locale, Record<Hash, Translation>>;
  dictionariesSnapshot: Record<Locale, Dictionary>;
  /**
   * I18nStore allows us to sync state updates in ConditionStore and I18nCache
   * with renders
   */
  i18nStore: I18nStore;
}


export const GTContext = createContext<GTContextType | undefined>(undefined);

export function useGTContext() {
  const context = useContext(GTContext);
  if (!context) {
    // TODO: softer error behavior
    throw new Error('useGTContext must be used within a GTProvider');
  }
  return context;
}