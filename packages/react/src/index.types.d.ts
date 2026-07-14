import type { ReactNode } from 'react';
import type { TxProps } from './utils/TxProps';

export { initializeGTSPA } from './setup/initializeGTSPA';
export { initializeGTSRA as initializeGT } from './setup/initializeGTSRA';
export { useLocaleSelector } from './components/useLocaleSelector';
export { useRegionSelector } from './components/useRegionSelector';
export {
  useSetLocale,
  useSetRegion,
  useSetEnableI18n,
} from './hooks/conditions-store';

// ===== Components ===== //
export { LocaleSelector } from './components/LocaleSelector';
export { RegionSelector } from './components/RegionSelector';
export { BrowserGTProvider as GTProvider } from './provider/BrowserGTProvider';

// ===== Components ===== //
export {
  Branch,
  Plural,
  Derive,
  GtInternalTranslateJsx,
  GtInternalVar,
  T,
  Currency,
  DateTime,
  RelativeTime,
  Var,
  Num,
} from '@generaltranslation/react-core/components';

export declare function Tx(_props: TxProps): Promise<ReactNode>;

// ===== Hooks ===== //
export {
  useLocale,
  useRegion,
  useCustomMapping,
  useDefaultLocale,
  useEnableI18n,
  useLocales,
  useFormatLocales,
  useGT,
  useMessages,
  useTranslations,
  useLocaleDirection,
  useLocaleProperties,
} from '@generaltranslation/react-core/hooks';

// ===== Functions ===== //
export {
  msg,
  decodeMsg,
  decodeOptions,
  derive,
  declareVar,
  decodeVars,
  mFallback,
  gtFallback,
  getFormatLocales,
  getDefaultLocale,
  getLocaleProperties,
  getLocales,
  resolveCanonicalLocale,
  getReactI18nCache,
  getTranslationsSnapshot,
  getVersionId,
  createRenderPipeline,
  setReactI18nCache,
  t,
} from '@generaltranslation/react-core/pure';

export type {
  RenderPipeline,
  RenderPreparedT,
} from '@generaltranslation/react-core/pure';

// ===== Singletons ===== //
export {
  ReactI18nCache,
  type ReactI18nCacheParams,
} from '@generaltranslation/react-core/pure';

// ===== Types ===== //
export type {
  CurrencyProps,
  DateTimeProps,
  JsxTranslationOptions,
  NumProps,
  PluralProps,
  PreparedT,
  RelativeTimeFormatOptions,
  RelativeTimeProps,
  RenderVariable,
  ResolvedCurrencyProps,
  ResolvedDateTimeProps,
  ResolvedNumProps,
  ResolvedPluralProps,
  ResolvedRelativeTimeProps,
} from '@generaltranslation/react-core/components-rsc';

export type { SharedGTProviderProps } from './provider/GTProviderProps';
export {
  GtInternalRuntimeTranslateJsx,
  GtInternalRuntimeTranslateString,
} from 'gt-i18n/internal';
export type {
  GTTranslationOptions,
  RuntimeTranslationOptions,
} from 'gt-i18n/types';
export type {
  SyncResolutionFunction,
  SyncResolutionFunctionWithFallback,
} from 'gt-i18n/types';
