import { GTContext, GTContextType } from "./GTContext";
import {
  useCallback,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { getI18nStore, setI18nStore } from "../i18n-store/singleton-operations";
import { type WritableConditionStoreParams } from "gt-i18n/internal";
import type { OverrideSetLocaleType } from "../i18n-store/storeTypes";
import {
  setStoresInitialized,
  getI18nStoreInitialized,
} from "../setup/globals";
import { I18nStore, I18nStoreParams } from "../i18n-store/I18nStore";

export type InternalGTProviderProps = WritableConditionStoreParams &
  I18nStoreParams & {
    children?: ReactNode;
    fallback?: ReactNode;
    /**
     * Reloads server side props when locale changes
     * To reload translations only from the client,
     * omit this prop
     * */
    overrideSetLocale?: OverrideSetLocaleType;
  };

// ===== Component ===== //

/**
 * - Shared provider logic btwn client and server providers
 * - It is assumed that the I18nManager and ConditionStore are already initialized.
 * - This is not userfacing, it should be wrapped in a userfacing provider
 * - If you want to override i18nManager or conditionStore, do so by calling
 *   initializeState() (or your own version of it) before GTProvider is
 *   rendered
 * - locale is required
 *
 * TODO: server side: only pass newly loaded translations to the client
 */
export function InternalGTProvider({
  children,
  fallback,
  ...config
}: InternalGTProviderProps) {
  // ------ Initialization ------ //

  if (!getI18nStoreInitialized()) {
    const i18nStore = new I18nStore(config);
    setI18nStore(i18nStore);

    setStoresInitialized(true);
  }

  // ------ Context ------ //

  const locale = useSyncExternalStore(
    getI18nStore().subscribeToLocale,
    getI18nStore().getLocaleSnapshot,
    getI18nStore().getLocaleSnapshot,
  );
  const setLocale = useCallback((locale: string) => {
    getI18nStore().setLocale(locale);
  }, []);
  const enableI18n = useSyncExternalStore(
    getI18nStore().subscribeToEnableI18n,
    getI18nStore().getEnableI18nSnapshot,
    getI18nStore().getEnableI18nSnapshot,
  );
  const setEnableI18n = useCallback((enableI18n: boolean) => {
    getI18nStore().setEnableI18n(enableI18n);
  }, []);
  const { status } = useSyncExternalStore(
    getI18nStore().subscribeToTranslationStatus,
    getI18nStore().getTranslationStatusSnapshot,
    getI18nStore().getTranslationStatusSnapshot,
  );

  const context: GTContextType = useMemo(
    () => ({
      locale,
      enableI18n,
      setLocale,
      setEnableI18n,
    }),
    [locale, enableI18n, setLocale, setEnableI18n],
  );

  // ------ Rendering ------ //

  // Show fallback when translations are loading (client only) from a locale change
  // locale will not be updated until the translations are loaded
  const display = !(status === "loading" && !config.overrideSetLocale);

  return (
    <GTContext.Provider value={context}>
      {display ? children : fallback}
    </GTContext.Provider>
  );
}
