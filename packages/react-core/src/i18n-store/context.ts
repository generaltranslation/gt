import { createContext, useContext } from 'react';
import { getI18nStore } from './singleton-operations';
import type { I18nStore } from './I18nStore';

export const I18nStoreContext = createContext<I18nStore | undefined>(undefined);

export function useI18nStoreWithFallback(): I18nStore {
  return useContext(I18nStoreContext) ?? getI18nStore();
}
