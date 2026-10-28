'use client';

import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import type { ReactNode } from 'react';
import type { TxProps } from './utils/TxProps';

// SSR/context-capable React runtime surface. This entrypoint may import hooks,
// providers, and context modules, so it must be consumed as a client boundary by
// React Server Component frameworks.

export { initializeGTSRA as initializeGT } from './setup/initializeGTSRA';
export { parseLocale } from './functions/parseLocale';
export { useLocaleSelector } from './components/useLocaleSelector';
export { useRegionSelector } from './components/useRegionSelector';

type InitializeGTSPA = typeof import('./setup/initializeGTSPA').initializeGTSPA;
type CreateOrUpdateBrowserConditionStore =
  typeof import('./condition-store/createBrowserConditionStore').createOrUpdateBrowserConditionStore;

const createBrowserConditionStoreServerError = createDiagnosticMessage({
  source: 'gt-react',
  severity: 'Error',
  whatHappened:
    'createOrUpdateBrowserConditionStore() cannot be called from the server runtime entry point',
  why: 'createOrUpdateBrowserConditionStore() initializes browser-only condition state.',
  fix: 'Call createOrUpdateBrowserConditionStore() from the browser runtime entry point.',
});

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

export const createOrUpdateBrowserConditionStore: CreateOrUpdateBrowserConditionStore =
  () => {
    throw new Error(createBrowserConditionStoreServerError);
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
  useLocaleDirection,
  useLocaleProperties,
  useSetLocale,
  useSetRegion,
  useSetEnableI18n,
} from '@generaltranslation/react-core/hooks';
// shortcut: R5 compat glue, removed in R6 when GTProvider/initializeGT stop accepting dictionaries
export { useTranslations } from '@generaltranslation/react-core/hooks';

// ===== Functions ===== //
export {
  msg,
  decodeMsg,
  decodeOptions,
  mFallback,
  gtFallback,
  getDefaultLocale,
  getLocaleProperties,
  getLocales,
  resolveCanonicalLocale,
  getVersionId,
} from 'gt-i18n';
export { derive, declareVar, decodeVars } from 'generaltranslation';
export {
  getTranslationsSnapshot,
  t,
} from '@generaltranslation/react-core/pure';

export type { SharedGTProviderProps } from './provider/GTProviderProps';
export {
  GtInternalRuntimeTranslateJsx,
  GtInternalRuntimeTranslateString,
} from 'gt-i18n/internal';
export type { GTTranslationOptions, RuntimeTranslationOptions } from 'gt-i18n';
