'use client';

import { initializeGTServer } from './setup/initGT.server';
/**
 * We need to invoke initializeGTServer() and not
 * initializeGTClient() because we also want to initialize
 * the AsyncConditionStore on the server side.
 */
initializeGTServer();

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
export type { GTTranslationOptions, RuntimeTranslationOptions } from 'gt-react';
