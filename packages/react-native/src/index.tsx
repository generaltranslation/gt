// ===== Components ===== //
export {
  Select,
  Currency,
  DateTime,
  Derive,
  N,
  Num,
  Ordinal,
  Plural,
  RelativeTime,
  T,
  Var,
} from '@generaltranslation/react-core/components';
export { GTProvider } from './provider/GTProvider';

// ===== Hooks ===== //
export {
  useCustomMapping,
  useDefaultLocale,
  useEnableI18n,
  useFormatLocales,
  useGT,
  useLocale,
  useLocaleDirection,
  useLocaleProperties,
  useLocales,
  useMessages,
  useRegion,
  useSetEnableI18n,
  useSetLocale,
  useSetRegion,
} from '@generaltranslation/react-core/hooks';
export { useLocaleSelector, useRegionSelector } from './hooks/selectors';

// ===== Functions ===== //
// No t or m: React Native registers no global locale store for them to read
// (the provider keeps it in context). Use useGT() and useMessages().
export { getTranslationsSnapshot } from '@generaltranslation/react-core/pure';
export {
  msg,
  mFallback,
  derive,
  plural,
  ordinal,
  select,
  num,
  date,
  time,
  part,
  n,
  getDefaultLocale,
  getLocaleProperties,
  getLocales,
  resolveCanonicalLocale,
  getVersionId,
} from 'gt-i18n';
export { getLocaleFromNativeStore } from './utils/nativeStore';
export { getLocale } from './utils/getLocale';
export { getNativeLocales } from './utils/getNativeLocales';
export { initializeGT } from './setup/initializeGT';

// ===== Types ===== //
export type { GT, GTOptions, M, Msg, Part, Placeholder } from 'gt-i18n';
export type { GTProviderProps } from './provider/GTProvider';
export type { GetLocaleParams } from './utils/getLocale';
export type { ReactInitializeGTParams as InitializeGTParams } from '@generaltranslation/react-core/pure';
