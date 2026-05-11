import { useRef } from "react";
import { I18nManager } from "gt-i18n/internal";
import { GTContext } from "./GTContext";
import { ProviderConditionStore } from "../store/ProviderConditionStore";
import { I18nStore } from "../store/I18nExternalStore";
import { setI18nExternalStore } from "../store/singleton-operations";
import type { I18nManagerConstructorParams } from "gt-i18n/internal/types";
import type { ReactNode } from "react";
import type { Translation } from "gt-i18n/types";

export type GTProviderProps = I18nManagerConstructorParams<Translation> & {
  children?: ReactNode;
  locale?: string;
  region?: string;
  getLocale?: () => string | undefined;
};

// ===== Component ===== //

/**
 * Minimal external-store provider.
 *
 * The condition store is created once per provider instance and exposed
 * through context. The manager-backed external store is initialized as a
 * singleton for hooks that read I18nManager snapshots.
 */
export function GTProvider({
  children,
  locale,
  region,
  getLocale,
  ...managerParams
}: GTProviderProps) {
  const conditionStoreRef = useRef<ProviderConditionStore | undefined>(
    undefined,
  );

  if (!conditionStoreRef.current) {
    const i18nManager = new I18nManager<Translation>(
      managerParams as I18nManagerConstructorParams<Translation>,
    );
    const conditionStore = new ProviderConditionStore({
      defaultLocale: i18nManager.getDefaultLocale(),
      locales: i18nManager.getLocales(),
      customMapping: i18nManager.getCustomMapping(),
      locale: locale || undefined,
      region,
      getLocale,
    });

    setI18nExternalStore(new I18nStore({ i18nManager }));
    conditionStoreRef.current = conditionStore;
  }

  const conditionStore = conditionStoreRef.current;
  if (!conditionStore) {
    throw new Error("GTProvider failed to initialize a condition store.");
  }

  return (
    <GTContext.Provider value={conditionStore}>{children}</GTContext.Provider>
  );
}
