import type { SharedGTProviderProps } from "./types";
import { InternalGTProvider } from "@generaltranslation/react-core/context";

/**
 * For the server side GTProvider, we don't need to synchronize translations
 * as this will happen during the loader
 */
export function SSRGTProvider({
  translations: _translations,
  dictionary: _dictionary,
  ...props
}: SharedGTProviderProps) {
  return <InternalGTProvider {...props} />;
}
