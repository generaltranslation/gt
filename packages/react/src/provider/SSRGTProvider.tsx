import { ReadonlyConditionStore } from "gt-i18n/internal";
import {
  isReadonlyConditionStoreInitialized,
  setReadonlyConditionStore,
} from "../condition-store/singleton-operations";
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
  defaultLocale = getReactI18nManager().getDefaultLocale(),
  locales = getReactI18nManager().getLocales(),
  customMapping = getReactI18nManager().getCustomMapping(),
  ...props
}: SharedGTProviderProps) {
  // The condition store may already be created at the module level
  if (!isReadonlyConditionStoreInitialized()) {
    console.log("SSRGTProvider initializing condition store", {
      locale: props.locale,
      defaultLocale: props.defaultLocale,
      locales: props.locales,
      customMapping: props.customMapping,
    });
    const conditionStore = new ReadonlyConditionStore({
      defaultLocale,
      locales,
      customMapping,
      ...props,
    });
    setReadonlyConditionStore(conditionStore);
  }
  console.log("SSRGTProvider", props.locale);
  getReactI18nManager().updateTranslations(translations);
  getReactI18nManager().updateDictionaries(dictionary ?? {});
  return <InternalGTProvider {...props} />;
}
