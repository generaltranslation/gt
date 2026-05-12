import { GTContext, GTContextType } from "./GTContext";
import {
  useCallback,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { ReactI18nManagerConstructorParams } from "../../state/ReactI18nManager";
import {
  initializeState,
  isGTInitialized,
} from "../../state/singleton-operations";
import {
  getI18nStore,
  initializeStores,
} from "../I18nStore/singleton-operations";
import type { ReloadServerSideProps } from "../I18nStore/storeTypes";

export type GTProviderProps = SharedGTProviderProps & {
  /**
   * Reloads server side props when locale changes
   * To reload translations only from the client,
   * omit this prop
   * */
  reloadServerSideProps?: ReloadServerSideProps;
};

export type SharedGTProviderProps = ReactI18nManagerConstructorParams & {
  children?: ReactNode;
  locale: string;
  fallback?: ReactNode;
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
export function SharedGTProvider({
  children,
  locale: initialLocale,
  fallback,
  ...managerParams
}: SharedGTProviderProps) {
  // ------ Initialization ------ //
  if (!isGTInitialized()) {
    throw new Error(
      "I18nManager, ConditionStore, and I18nStore must be initialized before using the SharedGTProvider",
    );
    initializeState({
      locale: initialLocale,
      config: managerParams,
      renderStrategy: "server-render",
    });
    initializeStores({ reloadServerSideProps });
  } else {
    getI18nStore().update({
      locale: initialLocale,
      translationsObj: managerParams.initialTranslations,
    });
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
