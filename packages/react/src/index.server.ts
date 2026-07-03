'use client';

import { createDiagnosticMessage } from 'generaltranslation/internal';
import type { ReactNode } from 'react';
import type { TxProps } from './utils/TxProps';

// SSR/context-capable React runtime surface. This entrypoint may import hooks,
// providers, and context modules, so it must be consumed as a client boundary by
// React Server Component frameworks.

export { initializeGTSRA as initializeGT } from './setup/initializeGTSRA';
export { useLocaleSelector } from './components/useLocaleSelector';
export { useRegionSelector } from './components/useRegionSelector';
export {
  useSetLocale,
  useSetRegion,
  useSetEnableI18n,
} from './hooks/conditions-store';

type InitializeGTSPA = typeof import('./setup/initializeGTSPA').initializeGTSPA;

export const initializeGTSPA: InitializeGTSPA = async () => {
  throw new Error(
    createDiagnosticMessage({
      source: 'gt-react',
      severity: 'Error',
      whatHappened:
        'initializeGTSPA() cannot be called from the server runtime entry point',
      why: 'initializeGTSPA() initializes browser-only SPA state and translation cache behavior.',
      fix: 'Use initializeGT() for server-rendered React runtimes or import initializeGTSPA from the browser entry point.',
    })
  );
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
