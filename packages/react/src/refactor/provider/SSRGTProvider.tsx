import { ReadonlyConditionStore } from "gt-i18n/internal";
import { setReadonlyConditionStore } from "../condition-store/singleton-operations";
import type { SharedGTProviderProps } from "./types";
import { InternalGTProvider } from "@generaltranslation/react-core/context";

/**
 * For the server side GTProvider, we don't need to synchronize translations
 * as this will happen during the loader
 *
 * TODO: find some way to enforce this is only imported on the server
 */
export function SSRGTProvider({
  translations: _translations,
  dictionary: _dictionary,
  ...props
}: SharedGTProviderProps) {
  const conditionStore = new ReadonlyConditionStore(props);
  setReadonlyConditionStore(conditionStore);
  return <InternalGTProvider {...props} />;
}
