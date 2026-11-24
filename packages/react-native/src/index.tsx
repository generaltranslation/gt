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
// No t or m: they need the locale's translations loaded before any module
// runs, and React Native loads them while the app starts. Use useGT() and
// useMessages(), or getGT() and getMessages() where no component is in reach.
export {
  getTranslationsSnapshot,
  getGT,
  getMessages,
} from '@generaltranslation/react-core/pure';
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
