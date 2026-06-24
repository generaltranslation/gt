'use client';

import { initializeGT } from './setup/initGT';
initializeGT();

import {
  Var,
  Num,
  Currency,
  DateTime,
  RelativeTime,
  Derive,
  T,
  Branch,
  Plural,
  LocaleSelector,
  RegionSelector,
  GTProvider,
  useSetLocale,
  useLocaleSelector,
  useGT,
  useTranslations,
  useLocale,
  useRegion,
  useLocales,
  useDefaultLocale,
  useMessages,
  useGTClass,
  useLocaleProperties,
  useLocaleDirection,
  useVersionId,
  msg,
  decodeMsg,
  decodeOptions,
  derive,
  declareVar,
  decodeVars,
  mFallback,
  gtFallback,
  getTranslationsSnapshot,
  getDefaultLocale,
  getGTClass,
  getLocaleProperties,
  getLocales,
  getVersionId,
} from 'gt-react';
import type {
  DictionaryTranslationOptions,
  InlineTranslationOptions,
  RuntimeTranslationOptions,
} from 'gt-react';
import type {
  GetServerSideProps,
  GetServerSidePropsContext,
  PreviewData,
} from 'next';
import type { ParsedUrlQuery } from 'querystring';
import type { WithGTServerSideProps } from './pages-dir/withGTServerSideProps';

export function parseLocale<
  Params extends ParsedUrlQuery = ParsedUrlQuery,
  Preview extends PreviewData = PreviewData,
>(_: GetServerSidePropsContext<Params, Preview>): string {
  throw new Error(
    'parseLocale() is only available from gt-next on the server.'
  );
}

export function withGTServerSideProps<
  Props extends Record<string, unknown> = Record<string, unknown>,
  Params extends ParsedUrlQuery = ParsedUrlQuery,
  Preview extends PreviewData = PreviewData,
>(
  _?: GetServerSideProps<Props, Params, Preview>
): GetServerSideProps<WithGTServerSideProps<Props>, Params, Preview> {
  throw new Error(
    'withGTServerSideProps() is only available from gt-next on the server.'
  );
}

export {
  T,
  Var,
  Num,
  Currency,
  DateTime,
  RelativeTime,
  Derive,
  Branch,
  Plural,
  GTProvider,
  LocaleSelector,
  RegionSelector,
  useSetLocale,
  useLocaleSelector,
  useGT,
  useTranslations,
  useLocale,
  useRegion,
  useLocales,
  useDefaultLocale,
  useGTClass,
  useLocaleProperties,
  useLocaleDirection,
  useVersionId,
  useMessages,
  msg,
  decodeMsg,
  decodeOptions,
  derive,
  declareVar,
  decodeVars,
  mFallback,
  gtFallback,
  getTranslationsSnapshot,
  getDefaultLocale,
  getGTClass,
  getLocaleProperties,
  getLocales,
  getVersionId,
};
export type {
  DictionaryTranslationOptions,
  InlineTranslationOptions,
  RuntimeTranslationOptions,
  WithGTServerSideProps,
};
