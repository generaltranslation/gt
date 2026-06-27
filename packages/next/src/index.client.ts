'use client';

import { initializeGT } from './setup/initGT';
initializeGT();

import {
  LocaleSelector,
  RegionSelector,
  GTProvider,
  useSetLocale,
  useLocaleSelector,
} from 'gt-react';
import {
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
import {
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
} from '@generaltranslation/react-core/hooks';
import {
  msg,
  decodeMsg,
  decodeOptions,
  derive,
  declareVar,
  decodeVars,
  mFallback,
  gtFallback,
  getDefaultLocale,
  getGTClass,
  getLocaleProperties,
  getLocales,
  getVersionId,
} from 'gt-i18n';
import { getTranslationsSnapshot } from '@generaltranslation/react-core/pure';
import type {
  DictionaryTranslationOptions,
  InlineTranslationOptions,
  RuntimeTranslationOptions,
} from 'gt-i18n/types';
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
