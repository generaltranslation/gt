export { getRequestLocale } from './functions/getRequestLocale';
export { GTProvider } from './provider/GTProvider';
export { initializeGT } from './setup/initializeGT';

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
  useRegion,
  useCustomMapping,
  useDefaultLocale,
  useEnableI18n,
  useLocales,
  useLocaleSelector,
  useLocaleDirection,
  useLocaleProperties,
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
  getDefaultLocale,
  getLocales,
  getLocaleProperties,
  resolveCanonicalLocale,
  getTranslationsSnapshot,
  getVersionId,
  t,
} from 'gt-react';
export type { GTTranslationOptions, RuntimeTranslationOptions } from 'gt-react';
