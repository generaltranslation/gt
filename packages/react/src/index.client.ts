'use client';

import type { ReactNode } from 'react';
import type { TxProps } from './utils/TxProps';
import {
  GtInternalRuntimeTranslateJsx,
  GtInternalRuntimeTranslateString,
} from './setup/runtimeTranslation';
import { t as clientT } from './functions/t.client';
import { t as runtimeT } from '@generaltranslation/react-core/pure';
import {
  getClientTranslationsSnapshot,
  getTranslationsSnapshot as getRuntimeTranslationsSnapshot,
  getReactI18nCache as getRuntimeReactI18nCache,
  ReactI18nCache as RuntimeReactI18nCache,
  setReactI18nCache as setRuntimeReactI18nCache,
} from '@generaltranslation/react-core/pure';
import type { Hash, Locale } from 'gt-i18n/internal/types';
import type { Translation } from 'gt-i18n/types';

class ProductionBrowserI18nCache {
  constructor() {
    unavailableInProductionBrowser();
  }
}

export { initializeGTSPA } from './setup/initializeGTSPA';
export { initializeGTSRAClient as initializeGT } from './setup/initializeGTSRAClient';
export { createOrUpdateBrowserConditionStore } from './condition-store/createBrowserConditionStore';
export { parseLocale } from './functions/parseLocale';
export { useLocaleSelector } from './components/useLocaleSelector';
export { useRegionSelector } from './components/useRegionSelector';

// ===== Components ===== //
export { LocaleSelector } from './components/LocaleSelector';
export { RegionSelector } from './components/RegionSelector';
export { BrowserGTProvider as GTProvider } from './provider/BrowserGTProvider.runtime';

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
} from '@generaltranslation/react-core/pure';

export const t = process.env.NODE_ENV === 'production' ? clientT : runtimeT;
export const getTranslationsSnapshot =
  process.env.NODE_ENV === 'production'
    ? getClientTranslationsSnapshotForLocale
    : getRuntimeTranslationsSnapshot;
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
    ? ProductionBrowserI18nCache
    : RuntimeReactI18nCache;

async function getClientTranslationsSnapshotForLocale(
  locale: Locale
): Promise<Record<Locale, Record<Hash, Translation>>> {
  const translations = getClientTranslationsSnapshot()[locale];
  return translations ? { [locale]: translations } : {};
}

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
export { GtInternalRuntimeTranslateJsx, GtInternalRuntimeTranslateString };
export type {
  GTTranslationOptions,
  RuntimeTranslationOptions,
} from 'gt-i18n/types';
export type {
  SyncResolutionFunction,
  SyncResolutionFunctionWithFallback,
} from 'gt-i18n/types';

export type { ReactI18nCacheParams } from '@generaltranslation/react-core/pure';
