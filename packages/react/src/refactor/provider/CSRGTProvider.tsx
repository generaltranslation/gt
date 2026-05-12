import { InternalGTProvider } from "@generaltranslation/react-core/context";
import type { SharedGTProviderProps } from "./types";
import { getI18nManager } from "gt-i18n/internal";

/**
 * Client side GTProvider, this is different from server side
 * GTProvider because needs to syncrhonize any incoming
 * server-side translations
 */
export function CSRGTProvider({
  translations,
  ...props
}: SharedGTProviderProps) {
  // This represents an update from server
  // TODO: if a specific translation entry changes, but not the locale, this does not trigger a re-render
  getI18nManager().updateTranslations(translations);
  return <InternalGTProvider {...props} />;
}
