import { type ReactNode } from "react";
import { setI18nStore } from "../i18n-store/singleton-operations";
import {
  setStoresInitialized,
  getI18nStoreInitialized,
} from "../setup/globals";
import { I18nStore, I18nStoreParams } from "../i18n-store/I18nStore";
import { getI18nManager } from "gt-i18n/internal";
import type { Dictionary, Translation } from "gt-i18n/types";
import type { Locale, Hash } from "gt-i18n/internal/types";

export type InternalGTProviderProps = I18nStoreParams & {
  children?: ReactNode;
  // For streaming translations to server
  translations: Record<Locale, Record<Hash, Translation>>;
  dictionaries?: Record<Locale, Dictionary>;
};

// ===== Component ===== //

/**
 * - Shared provider logic btwn client and server providers
 * - It is assumed that the I18nManager and ConditionStore are already initialized.
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
  if (!getI18nStoreInitialized()) {
    const i18nStore = new I18nStore(config);
    setI18nStore(i18nStore);

    setStoresInitialized(true);
  }

  // This represents an update from server, so bypass I18nStore
  getI18nManager().updateTranslations(translations);
  getI18nManager().updateDictionaries(dictionaries ?? {});

  return children;
}
