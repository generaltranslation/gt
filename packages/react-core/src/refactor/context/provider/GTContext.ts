import { createContext, useContext } from "react";

export type GTContextType = {
  locale: string;
  setLocale: (locale: string) => void;
};

export const GTContext = createContext<GTContextType | null>(null);

// ===== Condition Store Access ===== //

export function useConditionStore(): GTContextType {
  const conditionStore = useContext(GTContext);
  if (!conditionStore) {
    throw new Error(
      "GTProvider is required before external-store hooks can be used.",
    );
  }
  return conditionStore;
}
