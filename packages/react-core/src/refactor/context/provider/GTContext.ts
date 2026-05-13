import { createContext } from "react";

export type GTContextType = {
  locale: string;
  setLocale: (locale: string) => void;
  enableI18n: boolean;
  setEnableI18n: (enableI18n: boolean) => void;
};

export const GTContext = createContext<GTContextType | null>(null);
