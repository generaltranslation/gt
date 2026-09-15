'use client';

import type { ReactNode } from 'react';
import type { TxProps } from './utils/TxProps';
import {
  getReactI18nCache as getRuntimeReactI18nCache,
  ReactI18nCache as RuntimeReactI18nCache,
  setReactI18nCache as setRuntimeReactI18nCache,
} from '@generaltranslation/react-core/pure';
import {
  GtInternalRuntimeTranslateJsx as runtimeTranslateJsx,
  GtInternalRuntimeTranslateString as runtimeTranslateString,
} from 'gt-i18n/internal';

export { initializeGTSPA } from './setup/initializeGTSPA';
export { initializeGTSRAClient as initializeGT } from './setup/initializeGTSRAClient';
export { createOrUpdateBrowserConditionStore } from './condition-store/createBrowserConditionStore';
export { parseLocale } from './functions/parseLocale';
export { useLocaleSelector } from './components/useLocaleSelector';
export { useRegionSelector } from './components/useRegionSelector';

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
  useLocaleProperties,
  useSetLocale,
  useSetRegion,
  useSetEnableI18n,
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
  getVersionId,
  createRenderPipeline,
  getTranslationsSnapshot,
  t,
} from '@generaltranslation/react-core/pure';

// TODO: Move ReactI18nCache and its get/set helpers to a gt-react internal
// subpath, then remove their root exports from every runtime entrypoint.
export const getReactI18nCache =
  process.env.NODE_ENV === 'production'
    ? unavailableInProductionBrowser
    : getRuntimeReactI18nCache;
export const setReactI18nCache =
  process.env.NODE_ENV === 'production'
    ? unavailableInProductionBrowser
    : setRuntimeReactI18nCache;
export const ReactI18nCache =
  process.env.NODE_ENV === 'production'
    ? unavailableInProductionBrowser
    : RuntimeReactI18nCache;

function unavailableInProductionBrowser(): never {
  throw new Error(
    'I18nCache is not available in production browser builds. Use the translations provided to GTProvider instead.'
  );
}

export type {
  RenderPipeline,
  RenderPreparedT,
} from '@generaltranslation/react-core/pure';

export type { SharedGTProviderProps } from './provider/GTProviderProps';
const skipRuntimeTranslation = () => {};
export const GtInternalRuntimeTranslateJsx =
  process.env.NODE_ENV === 'production'
    ? skipRuntimeTranslation
    : runtimeTranslateJsx;
export const GtInternalRuntimeTranslateString =
  process.env.NODE_ENV === 'production'
    ? skipRuntimeTranslation
    : runtimeTranslateString;
export type {
  GTTranslationOptions,
  RuntimeTranslationOptions,
} from 'gt-i18n/types';
export type {
  SyncResolutionFunction,
  SyncResolutionFunctionWithFallback,
} from 'gt-i18n/types';

export type { ReactI18nCacheParams } from '@generaltranslation/react-core/pure';
