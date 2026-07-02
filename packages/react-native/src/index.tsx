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
  useTranslations,
  useVersionId,
} from '@generaltranslation/react-core/hooks';
export {
  useSetLocale,
  useSetRegion,
  useSetEnableI18n,
} from './hooks/condition-store';
export { useLocaleSelector, useRegionSelector } from './hooks/selectors';

// ===== Functions ===== //
export {
  createRenderPipeline,
  decodeMsg,
  decodeOptions,
  decodeVars,
  declareVar,
  derive,
  getDefaultLocale,
  getFormatLocales,
  getLocales,
  getReactI18nCache,
  getTranslationsSnapshot,
  getVersionId,
  gtFallback,
  mFallback,
  msg,
  setReactI18nCache,
} from '@generaltranslation/react-core/pure';
export { getLocaleFromNativeStore } from './utils/nativeStore';
export { getLocale } from './utils/getLocale';
export { initializeGT } from './setup/initializeGT';

// ===== Types ===== //
export type {
  GTTranslationOptions,
  RuntimeTranslationOptions,
  RenderPipeline,
  RenderPreparedT,
} from '@generaltranslation/react-core/pure';
export type { GTProviderProps } from './provider/GTProvider';
export type { GetLocaleParams } from './utils/getLocale';
export type { InitializeGTParams } from './setup/initializeGT';
