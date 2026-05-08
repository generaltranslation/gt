import { createContext, useContext } from 'react';
import type { I18nManager } from 'gt-i18n/internal';
import type { Translation } from 'gt-i18n/types';
import type { I18nExternalStore } from '../store/I18nExternalStore';

export const GTContext = createContext<I18nExternalStore | null>(null);

// ===== Store Access ===== //

export function useI18nExternalStore(): I18nExternalStore {
  const store = useContext(GTContext);
  if (!store) {
    throw new Error(
      'GTProvider is required before external-store hooks can be used.'
    );
  }
  return store;
}

export function useI18nManager(): I18nManager<Translation> {
  return useI18nExternalStore().getI18nManager();
}
