import { createContext, useContext } from 'react';
import type { Dictionary, Translation } from 'gt-i18n/types';
import type { Hash, Locale } from 'gt-i18n/internal/types';

export type ProviderI18nData = {
  translations: Record<Locale, Record<Hash, Translation>>;
  dictionaries?: Record<Locale, Dictionary>;
};

export const ProviderI18nDataContext = createContext<ProviderI18nData | null>(
  null
);

export function useProviderI18nData(): ProviderI18nData | null {
  return useContext(ProviderI18nDataContext);
}
