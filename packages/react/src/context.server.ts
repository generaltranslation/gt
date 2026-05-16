"server-only";

export { SSRGTProvider as GTProvider } from "./provider/SSRGTProvider";
export { initializeGTSPA } from "./setup/initializeGTSPA";

export {
  // ===== Components ===== //
  Branch,
  Plural,
  Derive,
  LocaleSelector,
  T,
  Currency,
  DateTime,
  RelativeTime,
  Var,
  Num,
  // ===== Hooks ===== //
  useLocale,
  useSetLocale,
  useCustomMapping,
  useDefaultLocale,
  useEnableI18n,
  useSetEnableI18n,
  useLocales,
  useLocaleSelector,
  useFormatLocales,
  useGT,
  useMessages,
  useTranslations,
  // ===== Functions ===== //
  getTranslationsSnapshot,
  getReactI18nManager,
  setReactI18nManager,
  // ===== Setup ===== //
  internalInitializeGTSSR as initializeGT,
  internalInitializeGTSPA,
} from "@generaltranslation/react-core/context";
