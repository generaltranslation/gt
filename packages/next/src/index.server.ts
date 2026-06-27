'use client';

import { initializeGT } from './setup/initGT';
import { parseLocale } from './pages-dir/parseLocale';
import { withGTServerSideProps } from './pages-dir/withGTServerSideProps';
initializeGT();

// ===== gt-react ===== //
export { parseLocale, withGTServerSideProps };
export type { WithGTServerSideProps } from './pages-dir/withGTServerSideProps';

export {
  GTProvider,
  LocaleSelector,
  RegionSelector,
  useSetLocale,
  useLocaleSelector,
} from 'gt-react';

export {
  Branch,
  Plural,
  Derive,
  T,
  Currency,
  DateTime,
  RelativeTime,
  Var,
  Num,
} from '@generaltranslation/react-core/components';

export {
  useLocale,
  useRegion,
  useLocaleDirection,
  useVersionId,
  useLocales,
  useDefaultLocale,
  useGTClass,
  useLocaleProperties,
  useGT,
  useMessages,
  useTranslations,
} from '@generaltranslation/react-core/hooks';

export {
  msg,
  decodeMsg,
  decodeOptions,
  declareVar,
  decodeVars,
  derive,
  mFallback,
  gtFallback,
  getDefaultLocale,
  getGTClass,
  getLocaleProperties,
  getLocales,
  getVersionId,
} from 'gt-i18n';

export { getTranslationsSnapshot } from '@generaltranslation/react-core/pure';

export type {
  DictionaryTranslationOptions,
  InlineTranslationOptions,
  RuntimeTranslationOptions,
} from 'gt-i18n/types';
