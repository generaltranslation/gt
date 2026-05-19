import { GTContext, GTContextType } from "../context/GTContext";
import { getRenderStrategy } from "../setup/globals";
import { getWritableConditionStore } from "../condition-store/singleton-operations";
import { useContext } from "react";

/**
 * @internal
 * @deprecated use condition store directly instead
 */
function useGTContext(property: keyof GTContextType): GTContextType {
  const conditionStore = useContext(GTContext);
  if (!conditionStore) {
    if (getRenderStrategy() === "SPA") {
      // No need for useSyncExternalStore for SPA apps as reload will always trigger a re-render
      const conditionStore = getWritableConditionStore();
      return {
        locale: conditionStore.getLocale(),
        enableI18n: conditionStore.getEnableI18n(),
        setLocale: conditionStore.setLocale,
        setEnableI18n: conditionStore.setEnableI18n,
      };
    }
    throw new Error(
      `use${(property as string).charAt(0).toUpperCase() + (property as string).slice(1)}() is being accessed outside of a <GTProvider>. Make sure to add a <GTProvider> to the top of your component tree.`,
    );
  }
  return conditionStore;
}

export function useLocale(): string {
  return getLocale();
}

export function getLocale(): string {
  return getWritableConditionStore().getLocale();
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
