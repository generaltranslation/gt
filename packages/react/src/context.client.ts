'use client';

export { initializeGTSPA } from './setup/initializeGTSPA';
export { useLocaleSelector } from './components/useLocaleSelector';
export { useSetLocale, useSetEnableI18n } from './hooks/conditions-store';
export {
  defaultEnableI18nCookieName,
  defaultLocaleCookieName,
  defaultRegionCookieName,
} from './cookie-names';

// ===== Components ===== //
export { LocaleSelector } from './components/LocaleSelector';
export { BrowserGTProvider as GTProvider } from './provider/BrowserGTProvider';

// ===== Components ===== //
export {
  Branch,
  Plural,
  Derive,
  GtInternalTranslateJsx,
  T,
  Currency,
  DateTime,
  RelativeTime,
  Var,
  Num,
} from '@generaltranslation/react-core/components';

// ===== Hooks ===== //
export {
  useLocale,
  useCustomMapping,
  useDefaultLocale,
  useEnableI18n,
  useLocales,
  useFormatLocales,
  useGT,
  useMessages,
  useTranslations,
  useLocaleDirection,
  useVersionId,
  useGTClass,
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
  initializeGT,
  getDefaultLocale,
  getGTClass,
  getLocaleProperties,
  getLocales,
  getVersionId,
} from '@generaltranslation/react-core/pure';

// TODO: move these over to pure
export {
  getTranslationsSnapshot,
  getReactI18nCache,
  setReactI18nCache,
  createRenderPipeline,
  t,
} from '@generaltranslation/react-core/context';

export type {
  RenderPipeline,
  RenderPreparedT,
} from '@generaltranslation/react-core/context';

// ===== Singletons ===== //
export {
  ReactI18nCache,
  type ReactI18nCacheParams,
} from '@generaltranslation/react-core/pure';
