'use client';

import { initializeGT } from './setup/initGT';
/**
 * No initializeGTServer() here because we do not want to
 * initialize the AsyncConditionStore on the server side.
 *
 * No initializeGTClient() here because we do want to enforce
 * expiry times here.
 */
initializeGT();

// ===== Pages Router ===== //
export { parseLocale } from './pages-dir/parseLocale';
export { withGTServerSideProps } from './pages-dir/withGTServerSideProps';
export type { WithGTServerSideProps } from './pages-dir/withGTServerSideProps';
export { withGTStaticProps } from './pages-dir/withGTStaticProps';
export type { WithGTStaticProps } from './pages-dir/withGTStaticProps';

// ===== Components ===== //
export {
  Branch,
  Currency,
  DateTime,
  Derive,
  GTProvider,
  GtInternalTranslateJsx,
  GtInternalVar,
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
  useLocaleDirection,
  useLocales,
  useLocaleProperties,
  useLocaleSelector,
  useLocale,
  useMessages,
  useRegion,
  useSetLocale,
} from 'gt-react';

// ===== Functions ===== //
export {
  date,
  derive,
  getDefaultLocale,
  getLocaleProperties,
  getLocales,
  resolveCanonicalLocale,
  getVersionId,
  mFallback,
  msg,
  n,
  number,
  part,
  plural,
  select,
  selectordinal,
  time,
} from 'gt-i18n';
export { getTranslationsSnapshot } from '@generaltranslation/react-core/pure';
export { useLocalizeHref } from './link/useLocalizeHref';
export { isLocaleSupported } from './request/localeValidation';

// ===== Types ===== //
export type { GT, GTOptions, M, Msg, Part, Placeholder } from 'gt-i18n';
