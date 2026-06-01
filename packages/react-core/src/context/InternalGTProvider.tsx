import { useMemo, type ReactNode } from 'react';
import {
  isI18nStoreInitialized,
  setI18nStore,
} from '../i18n-store/singleton-operations';
import { I18nStore, I18nStoreParams } from '../i18n-store/I18nStore';
import { ProviderI18nDataContext } from './provider-data';
import type { Dictionary, Translation } from 'gt-i18n/types';
import type { Locale, Hash } from 'gt-i18n/internal/types';

export type InternalGTProviderProps = I18nStoreParams & {
  children?: ReactNode;
  // For streaming translations to server
  translations: Record<Locale, Record<Hash, Translation>>;
  dictionaries?: Record<Locale, Dictionary>;
};

// ===== Component ===== //

/**
 * - Shared provider logic btwn client and server providers
 * - It is assumed that the I18nCache and ConditionStore are already initialized.
 * - This is not userfacing, it should be wrapped in a userfacing provider
 * - Locale and translations (and dictionaries if applicable) are required
 *
 * TODO: selectively filter to only pass new translations to client for dev hot reload
 * TODO: rename parent directory to "/provider" (separate PR)
 */
export function InternalGTProvider({
  children,
  translations,
  dictionaries,
  ...config
}: InternalGTProviderProps) {
  if (!isI18nStoreInitialized()) {
    const i18nStore = new I18nStore(config);
    setI18nStore(i18nStore);
  }

  const providerData = useMemo(
    () => ({ translations, dictionaries }),
    [translations, dictionaries]
  );

  return (
    <ProviderI18nDataContext.Provider value={providerData}>
      {children}
    </ProviderI18nDataContext.Provider>
  );
}
