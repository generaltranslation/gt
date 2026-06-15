'use client';

import type { ReactNode } from 'react';

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

type TxProps = Record<string, ReactNode> & {
  children: ReactNode;
  context?: string;
  locale?: string;
  maxChars?: number;
  $context?: string;
  $locale?: string;
  $maxChars?: number;
};

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

export type { SharedGTProviderProps } from './provider/GTProviderProps';

// ===== Singletons ===== //
export {
  ReactI18nCache,
  type ReactI18nCacheParams,
} from '@generaltranslation/react-core/pure';
