import { ReadonlyConditionStore } from "gt-i18n/internal";
import { setReadonlyConditionStore } from "../condition-store/singleton-operations";
import type { SharedGTProviderProps } from "./SharedGTProviderProps";
import {
  getReactI18nManager,
  InternalGTProvider,
} from "@generaltranslation/react-core/context";

/**
 * For the server side GTProvider, we don't need to synchronize translations
 * as this will happen during the loader
 *
 * TODO: find some way to enforce this is only imported on the server
 */
export function SSRGTProvider({
  translations,
  dictionary,
  ...props
}: SharedGTProviderProps) {
  const conditionStore = new ReadonlyConditionStore(props);
  setReadonlyConditionStore(conditionStore);
  getReactI18nManager().updateTranslations(translations);
  getReactI18nManager().updateDictionaries(dictionary ?? {});
  return <InternalGTProvider {...props} />;
}
