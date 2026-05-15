import {
  getReactI18nManager,
  InternalGTProvider,
} from "@generaltranslation/react-core/context";
import type { SharedGTProviderProps } from "./SharedGTProviderProps";
import {
  getBrowserConditionStore,
  isBrowserConditionStoreInitialized,
  setBrowserConditionStore,
} from "../condition-store/singleton-operations";
import { BrowserConditionStore } from "../condition-store/BrowserConditionStore";
import { createBrowserConditionStore } from "../condition-store/createBrowserConditionStore";

/**
 * Client side GTProvider, this is different from server side
 * GTProvider because needs to syncrhonize any incoming
 * server-side translations
 */
export function CSRGTProvider({
  translations,
  dictionary,
  ...props
}: SharedGTProviderProps) {
  // TODO: if a specific translation entry changes, but not the locale, this does not trigger a re-render
  // TODO: optimize by skipping updateTranslations() if client is responsible for reloading translations
  // (eg overrideSetLocale === undefined), see getI18nStore().updateLocale() in InternalGTProvider

  if (!isBrowserConditionStoreInitialized()) {
    const conditionStore = createBrowserConditionStore(props);
    setBrowserConditionStore(conditionStore);
  } else if (props.overrideSetLocale) {
    // This represents an update from server, so bypass I18nStore
    // we only listen to it if we trigger server-side reloads on locale change
    getBrowserConditionStore().setLocale(props.locale);
  }
  getReactI18nManager().updateTranslations(translations);
  getReactI18nManager().updateDictionaries(dictionary ?? {});
  return <InternalGTProvider {...props} />;
}
