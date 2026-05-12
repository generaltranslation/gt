"server-only";

export { SSRGTProvider as GTProvider } from "./refactor/provider/SSRGTProvider";

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
  useLocales,
  useLocaleSelector,
  useFormatLocales,
  // ===== Functions ===== //
  getTranslationsSnapshot,
  // ===== Setup ===== //
  internalInitializeGTSSR as initializeGT,
} from "@generaltranslation/react-core/context";
