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
import { getI18nStore } from "../store/singleton-operations";

export type GTProviderProps = ReactI18nManagerConstructorParams & {
  children?: ReactNode;
  locale: string;
  fallback?: ReactNode;
};

// ===== Component ===== //

/**
 * - If you want to override i18nManager or conditionStore, do so by calling
 *   initializeState() (or your own version of it) before GTProvider is
 *   rendered
 * - locale and initialTranslations are required
 */
export function GTProvider({
  children,
  locale: initialLocale,
  fallback,
  ...managerParams
}: GTProviderProps) {
  // ------ Initialization ------ //
  if (!isGTInitialized()) {
    initializeState({
      locale: initialLocale,
      config: managerParams,
      renderStrategy: "server-render",
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

  // Show fallback when translations are loading for a locale change
  // locale will not be updated until the translations are loaded
  const display = status !== "loading";

  return (
    <GTContext.Provider value={context}>
      {display ? children : fallback}
    </GTContext.Provider>
  );
}
