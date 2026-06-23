'use client';

import { initializeGT } from './setup/initGT';
import { parseLocale } from './pages-dir/parseLocale';
import { withGTServerSideProps } from './pages-dir/withGTServerSideProps';
initializeGT();

// ===== gt-react ===== //
export { parseLocale, withGTServerSideProps };
export type { WithGTServerSideProps } from './pages-dir/withGTServerSideProps';

export {
  // ----- components ----- //
  GTProvider,
  Var,
  Num,
  Currency,
  DateTime,
  RelativeTime,
  Derive,
  Branch,
  Plural,
  T,
  LocaleSelector,
  RegionSelector,
  // ----- hooks ----- //
  useGT,
  useTranslations,
  useMessages,
  useSetLocale,
  useLocaleSelector,
  useLocale,
  useRegion,
  useLocaleDirection,
  useVersionId,
  useLocales,
  useDefaultLocale,
  useGTClass,
  useLocaleProperties,
  // ----- functions ----- //
  msg,
  decodeMsg,
  decodeOptions,
  declareVar,
  decodeVars,
  derive,
  mFallback,
  gtFallback,
  getTranslationsSnapshot,
  getDefaultLocale,
  getGTClass,
  getLocaleProperties,
  getLocales,
  getVersionId,
} from 'gt-react';

export type {
  DictionaryTranslationOptions,
  InlineTranslationOptions,
  RuntimeTranslationOptions,
} from 'gt-react';
