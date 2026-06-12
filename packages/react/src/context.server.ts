'use client';

// SSR/context-capable React runtime surface. This entrypoint may import hooks,
// providers, and context modules, so it must be consumed as a client boundary by
// React Server Component frameworks.

export { initializeGTSPA } from './setup/initializeGTSPA';
export { useLocaleSelector } from './components/useLocaleSelector';
export { useSetLocale, useSetEnableI18n } from './hooks/conditions-store';
export {
  defaultEnableI18nCookieName,
  defaultLocaleCookieName,
  defaultRegionCookieName,
} from './cookie-names';

// ===== Components ===== //
export { ServerGTProvider as GTProvider } from './provider/ServerGTProvider';
export { LocaleSelector } from './components/LocaleSelector';

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
  getDefaultLocale,
  getGTClass,
  getLocaleProperties,
  getLocales,
  getVersionId,
} from '@generaltranslation/react-core/pure';

export {
  getTranslationsSnapshot,
  createRenderPipeline,
  t,
  // ===== Setup ===== //
  getReactI18nCache,
  setReactI18nCache,
  internalInitializeGTSRA as initializeGT,
  internalInitializeGTSPA,
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