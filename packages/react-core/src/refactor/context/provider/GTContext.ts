import { createContext, useContext } from "react";

export type GTContextType = {
  locale: string;
  setLocale: (locale: string) => void;
};

export const GTContext = createContext<GTContextType | null>(null);
