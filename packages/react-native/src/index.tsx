// ===== Components ===== //
export {
  Branch,
  Currency,
  DateTime,
  Derive,
  Num,
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
export { getTranslationsSnapshot } from '@generaltranslation/react-core/pure';
export {
  decodeMsg,
  decodeOptions,
  getDefaultLocale,
  getLocaleProperties,
  getLocales,
  resolveCanonicalLocale,
  getVersionId,
  gtFallback,
  mFallback,
  msg,
} from 'gt-i18n';
export { decodeVars, declareVar, derive } from 'generaltranslation';
export { getLocaleFromNativeStore } from './utils/nativeStore';
export { getLocale } from './utils/getLocale';
export { internalInitializeGTSRA as initializeGT } from '@generaltranslation/react-core/pure';

// ===== Types ===== //
export type { GTTranslationOptions, RuntimeTranslationOptions } from 'gt-i18n';
export type { GTProviderProps } from './provider/GTProvider';
export type { GetLocaleParams } from './utils/getLocale';
export type { ReactInitializeGTParams as InitializeGTParams } from '@generaltranslation/react-core/pure';
