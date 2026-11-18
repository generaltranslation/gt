'use client';

import type { ReactNode } from 'react';
import type { TxProps } from './utils/TxProps';

export { initializeGTSPA } from './setup/initializeGTSPA';
export { initializeGTSRA as initializeGT } from './setup/initializeGTSRA';
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
  Ordinal,
  Plural,
  Derive,
  GtInternalTranslateJsx,
  GtInternalVar,
  T,
  Currency,
  DateTime,
  RelativeTime,
  Var,
  N,
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

// ===== Functions ===== //
export {
  msg,
  mFallback,
  derive,
  plural,
  selectordinal,
  select,
  number,
  date,
  time,
  part,
  n,
  getDefaultLocale,
  getLocaleProperties,
  getLocales,
  resolveCanonicalLocale,
  getVersionId,
} from 'gt-i18n';
export {
  getTranslationsSnapshot,
  t,
  m,
} from '@generaltranslation/react-core/pure';

// ===== Types ===== //
export type {
  BranchProps,
  CurrencyProps,
  DateTimeProps,
  JsxTranslationOptions,
  NProps,
  NumProps,
  PluralProps,
  PreparedT,
  RelativeTimeProps,
  ResolvedCurrencyProps,
  ResolvedDateTimeProps,
  ResolvedNProps,
  ResolvedNumProps,
  ResolvedPluralProps,
  ResolvedRelativeTimeProps,
} from '@generaltranslation/react-core/components-rsc';
export type {
  RelativeTimeFormatOptions,
  RenderVariable,
} from '@generaltranslation/react-core/pure';

export type { SharedGTProviderProps } from './provider/GTProviderProps';
export { GtInternalRuntimeTranslateJsx } from 'gt-i18n/internal';
export type { GT, GTOptions, M, Msg, Part, Placeholder } from 'gt-i18n';
