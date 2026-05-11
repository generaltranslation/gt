import { createContext, useContext } from "react";
import type { I18nManager } from "gt-i18n/internal";
import type { Translation } from "gt-i18n/types";
import type { I18nStore } from "../store/I18nStore";
import type { ProviderConditionStore } from "../store/ProviderConditionStore";
import { getI18nStore } from "../store/singleton-operations";

export const GTContext = createContext<ProviderConditionStore | null>(null);

// ===== Condition Store Access ===== //

export function useConditionStore(): ProviderConditionStore {
  const conditionStore = useContext(GTContext);
  if (!conditionStore) {
    throw new Error(
      "GTProvider is required before external-store hooks can be used.",
    );
  }
  return conditionStore;
}

// ===== Manager Store Access ===== //

export function useI18nExternalStore(): I18nStore {
  return getI18nStore();
}

export function useI18nManager(): I18nManager<Translation> {
  return useI18nExternalStore().getI18nManager();
}
