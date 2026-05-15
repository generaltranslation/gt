import { GTContext, GTContextType } from "../context/provider/GTContext";
import { getRenderStrategy } from "../setup/globals";
import { getConditionStore } from "../condition-store/singleton-operations";
import { useContext } from "react";

/**
 * @internal
 */
function useGTContext(property: keyof GTContextType): GTContextType {
  const conditionStore = useContext(GTContext);
  if (!conditionStore) {
    if (getRenderStrategy() === "SPA") {
      // No need for useSyncExternalStore for SPA apps as reload will always trigger a re-render
      return {
        locale: getConditionStore().getLocale(),
        enableI18n: getConditionStore().getEnableI18n(),
        setLocale: getConditionStore().setLocale,
        setEnableI18n: getConditionStore().setEnableI18n,
      };
    }
    throw new Error(
      `use${property.charAt(0).toUpperCase() + property.slice(1)}() is being accessed outside of a <GTProvider>. Make sure to add a <GTProvider> to the top of your component tree.`,
    );
  }
  return conditionStore;
}

export function useLocale(): string {
  return useGTContext("locale").locale;
}

export function useSetLocale(): (locale: string) => void {
  return useGTContext("setLocale").setLocale;
}

export function useEnableI18n(): boolean {
  return useGTContext("enableI18n").enableI18n;
}

export function useSetEnableI18n(): (enableI18n: boolean) => void {
  return useGTContext("setEnableI18n").setEnableI18n;
}
