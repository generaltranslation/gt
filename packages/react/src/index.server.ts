'use client';

import type { ReactNode } from 'react';
import type { TxProps } from './TxProps';

// SSR/context-capable React runtime surface. This entrypoint may import hooks,
// providers, and context modules, so it must be consumed as a client boundary by
// React Server Component frameworks.

export { initializeGTSPA } from './setup/initializeGTSPA';
export { useLocaleSelector } from './components/useLocaleSelector';
export { useRegionSelector } from './components/useRegionSelector';
export {
  useSetLocale,
  useSetRegion,
  useSetEnableI18n,
} from './hooks/conditions-store';
export {
  defaultEnableI18nCookieName,
  defaultLocaleCookieName,
  defaultRegionCookieName,
} from './cookie-names';

// ===== Components ===== //
export { ServerGTProvider as GTProvider } from './provider/ServerGTProvider';
export { LocaleSelector } from './components/LocaleSelector';
export { RegionSelector } from './components/RegionSelector';

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

export async function Tx(_props: TxProps): Promise<ReactNode> {
  throw new Error('Tx is only supported via RSC');
}

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
  getReactI18nCache,
  getTranslationsSnapshot,
  getVersionId,
  createRenderPipeline,
  internalInitializeGTSRA as initializeGT,
  setReactI18nCache,
  t,
} from '@generaltranslation/react-core/pure';

export type {
  RenderPipeline,
  RenderPreparedT,
} from '@generaltranslation/react-core/pure';

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

// ===== Singletons ===== //
export {
  ReactI18nCache,
  type ReactI18nCacheParams,
} from '@generaltranslation/react-core/pure';
