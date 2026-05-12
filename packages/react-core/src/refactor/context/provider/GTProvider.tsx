import { GTContext, GTContextType } from "./GTContext";
import {
  useCallback,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { getI18nStore } from "../I18nStore/singleton-operations";
import type { ReloadServerSideProps } from "../I18nStore/storeTypes";
import { storesInitialized } from "./globals";
import { I18nStoreParams } from "../I18nStore/I18nStore";
import { ReactConditionStoreParams } from "../../condition-store/ReactConditionStore";
import { initializeContextStores } from "./initializeContextStores";

export type GTProviderProps = ReactConditionStoreParams &
  I18nStoreParams & {
    children?: ReactNode;
    fallback?: ReactNode;
    /**
     * Reloads server side props when locale changes
     * To reload translations only from the client,
     * omit this prop
     * */
    reloadServerSideProps?: ReloadServerSideProps;
    /**
     * From the server
     */
    locale: string;
    translations: ;
  };

// ===== Component ===== //

/**
 * - Shared provider logic btwn client and server providers
 * - It is assumed that the I18nManager, ConditionStore, and I18nStore are already initialized
 * - This is not userfacing, it should be wrapped in a userfacing provider
 * - If you want to override i18nManager or conditionStore, do so by calling
 *   initializeState() (or your own version of it) before GTProvider is
 *   rendered
 * - locale and initialTranslations are required
 *
 * TODO: server side: only pass newly loaded translations to the client
 */
export function GTProvider({
  children,
  locale: initialLocale,
  defaultLocale,
  locales,
  customMapping,
  i18nEnabled,
  reloadServerSideProps,
  fallback,
  translations,
}: GTProviderProps) {
  // ------ Initialization ------ //
  if (!storesInitialized()) {
    initializeContextStores({
      locale: initialLocale,
      renderStrategy: "server-render",
      defaultLocale,
      locales,
      customMapping,
      i18nEnabled,
      reloadServerSideProps,
    });
  } else {
    // This represents an update from server
    getI18nStore().updateLocale(initialLocale);
    // TODO: translations cache gets updated differently depending on runtime environment (client, server, hermes)
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
  const { status } = useSyncExternalStore(
    getI18nStore().subscribeToTranslationStatus,
    getI18nStore().getTranslationStatusSnapshot,
    getI18nStore().getTranslationStatusSnapshot,
  );

  const context: GTContextType = useMemo(
    () => ({
      locale,
      setLocale,
    }),
    [locale, setLocale],
  );

  // ------ Rendering ------ //

  // Show fallback when translations are loading (client only) from a locale change
  // locale will not be updated until the translations are loaded
  const display = !(status === "loading" && !reloadServerSideProps);

  return (
    <GTContext.Provider value={context}>
      {display ? children : fallback}
    </GTContext.Provider>
  );
}
