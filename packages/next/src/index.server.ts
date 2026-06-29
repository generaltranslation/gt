'use client';

import { initializeGT } from './setup/initGT';
initializeGT();

// ===== Pages Router ===== //
export { parseLocale } from './pages-dir/parseLocale';
export { withGTServerSideProps } from './pages-dir/withGTServerSideProps';
export type { WithGTServerSideProps } from './pages-dir/withGTServerSideProps';

// ===== Components ===== //
export {
  Branch,
  Currency,
  DateTime,
  Derive,
  GTProvider,
  T,
  LocaleSelector,
  Num,
  Plural,
  RegionSelector,
  RelativeTime,
  Var,
} from 'gt-react';

// ===== Hooks ===== //
export {
  useDefaultLocale,
  useGT,
  useGTClass,
  useLocaleDirection,
  useLocales,
  useLocaleProperties,
  useLocaleSelector,
  useLocale,
  useMessages,
  useRegion,
  useSetLocale,
  useTranslations,
  useVersionId,
} from 'gt-react';

// ===== Functions ===== //
export {
  decodeMsg,
  decodeOptions,
  decodeVars,
  declareVar,
  derive,
  getDefaultLocale,
  getGTClass,
  getLocaleProperties,
  getLocales,
  getTranslationsSnapshot,
  getVersionId,
  gtFallback,
  mFallback,
  msg,
} from 'gt-react';

// ===== Types ===== //
export type {
  DictionaryTranslationOptions,
  InlineTranslationOptions,
  RuntimeTranslationOptions,
} from 'gt-react';
