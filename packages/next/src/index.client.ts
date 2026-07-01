'use client';

import { initializeGTClient } from './setup/initGT.client';
initializeGTClient();

import type {
  GetServerSideProps,
  GetServerSidePropsContext,
  PreviewData,
} from 'next';
import type { ParsedUrlQuery } from 'querystring';
import type { WithGTServerSideProps } from './pages-dir/withGTServerSideProps';

// ===== Unsupported Server APIs ===== //
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

// ===== Components ===== //
export {
  Branch,
  Currency,
  DateTime,
  Derive,
  GTProvider,
  LocaleSelector,
  Num,
  Plural,
  RegionSelector,
  RelativeTime,
  T,
  Var,
} from 'gt-react';

// ===== Hooks ===== //
export {
  useDefaultLocale,
  useGT,
  useGTClass,
  useLocale,
  useLocaleDirection,
  useLocaleProperties,
  useLocales,
  useLocaleSelector,
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
export type { WithGTServerSideProps };
