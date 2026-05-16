// ===== Components ===== //
export { Branch } from "./components/branches/Branch";
export { Plural } from "./components/branches/Plural";
export { Derive } from "./components/derivation/Derive";
export { LocaleSelector } from "./components/helpers/LocaleSelector";
export { T } from "./components/translation/T";
export { Currency } from "./components/variables/Currency";
export { DateTime } from "./components/variables/DateTime";
export { Num } from "./components/variables/Num";
export { RelativeTime } from "./components/variables/RelativeTime";
export { Var } from "./components/variables/Var";

// ===== Hooks ===== //
export {
  useLocale,
  useSetLocale,
  useEnableI18n,
  useSetEnableI18n,
} from "./hooks/context-hooks";
export {
  useCustomMapping,
  useDefaultLocale,
  useLocales,
} from "./hooks/external-store-hooks";
export { useGT } from "./hooks/useGT";
export { useMessages } from "./hooks/useMessages";
export { useTranslations } from "./hooks/useTranslations";
export { useLocaleSelector } from "./hooks/useLocaleSelector";
export { useFormatLocales } from "./hooks/utils";

// ===== Functions ===== //
export { getTranslationsSnapshot } from "./functions/helpers/getTranslationsSnapshot";

// ===== Internal ===== //
export { InternalGTProvider } from "./context/provider/InternalGTProvider";
export { internalInitializeGTSPA } from "./setup/initializeGTSPA";
export { internalInitializeGTSSR } from "./setup/initializeGTSSR";
export { getI18nStore, setI18nStore } from "./i18n-store/singleton-operations";
export {
  setRenderStrategy,
  getRenderStrategy,
  setStoresInitialized,
} from "./setup/globals";
export {
  getWritableConditionStore as getConditionStore,
  setWritableConditionStore as setConditionStore,
} from "./condition-store/singleton-operations";
export { WritableConditionStore } from "gt-i18n/internal";
export type { WritableConditionStoreParams } from "gt-i18n/internal";
export {
  getReactI18nManager,
  setReactI18nManager,
} from "./i18n-manager/singleton-operations";
export { I18nStore } from "./i18n-store/I18nStore";
export type { I18nStoreParams } from "./i18n-store/I18nStore";
export type { InternalGTProviderProps } from "./context/provider/InternalGTProvider";
export type { OverrideSetLocaleType } from "./i18n-store/storeTypes";
export type {
  ReactI18nManager,
  ReactI18nManagerParams,
} from "./i18n-manager/ReactI18nManager";
