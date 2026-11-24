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
export { GTProvider } from './provider/GTProvider';

// ===== Components ===== //
export {
  Select,
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
  ordinal,
  select,
  num,
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
  getGT,
  getMessages,
  t,
  m,
} from '@generaltranslation/react-core/pure';

// ===== Types ===== //
export type {
  SelectProps,
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

export type {
  GTProviderProps,
  SharedGTProviderProps,
} from './provider/GTProviderProps';
export { GtInternalRuntimeTranslateJsx } from 'gt-i18n/internal';
export type { GT, GTOptions, M, Msg, Part, Placeholder } from 'gt-i18n';
