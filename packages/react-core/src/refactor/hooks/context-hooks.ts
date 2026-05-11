import { useContext, useSyncExternalStore } from "react";
import { GTContext, GTContextType } from "../context/provider/GTContext";
import {
  getConditionStore,
  getRenderStrategy,
} from "../state/singleton-operations";

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
        setLocale: getConditionStore().setLocale,
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
