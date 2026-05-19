"use client";

export { CSRGTProvider as GTProvider } from "./provider/CSRGTProvider";
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
  msg,
  decodeMsg,
  decodeOptions,
  derive,
  declareVar,
  decodeVars,
  mFallback,
  gtFallback,
  getTranslationsSnapshot,
  getReactI18nManager,
  setReactI18nManager,
  t,
  // ===== Setup ===== //
  internalInitializeGTSSR as initializeGT,
} from "@generaltranslation/react-core/context";
