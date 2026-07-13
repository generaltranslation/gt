'use client';

import { initializeGTClient } from './setup/initGT.client';
initializeGTClient();

import type {
  GetServerSideProps,
  GetServerSidePropsContext,
  GetStaticProps,
  PreviewData,
} from 'next';
import type { ParsedUrlQuery } from 'querystring';
import type { WithGTServerSideProps } from './pages-dir/withGTServerSideProps';
import type { WithGTStaticProps } from './pages-dir/withGTStaticProps';

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

export function withGTStaticProps<
  Props extends Record<string, unknown> = Record<string, unknown>,
  Params extends ParsedUrlQuery = ParsedUrlQuery,
  Preview extends PreviewData = PreviewData,
>(
  getStaticProps?: GetStaticProps<Props, Params, Preview>
): GetStaticProps<WithGTStaticProps<Props>, Params, Preview>;
export function withGTStaticProps<
  Props extends Record<string, unknown> = Record<string, unknown>,
  Params extends ParsedUrlQuery = ParsedUrlQuery,
  Preview extends PreviewData = PreviewData,
>(
  locale: string,
  getStaticProps?: GetStaticProps<Props, Params, Preview>
): GetStaticProps<WithGTStaticProps<Props>, Params, Preview>;
export function withGTStaticProps<
  Props extends Record<string, unknown> = Record<string, unknown>,
  Params extends ParsedUrlQuery = ParsedUrlQuery,
  Preview extends PreviewData = PreviewData,
>(
  _firstArg?: string | GetStaticProps<Props, Params, Preview>,
  _secondArg?: GetStaticProps<Props, Params, Preview>
): GetStaticProps<WithGTStaticProps<Props>, Params, Preview> {
  throw new Error(
    'withGTStaticProps() is only available from gt-next on the server.'
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
  useLocale,
  useLocaleDirection,
  useLocaleProperties,
  useLocales,
  useLocaleSelector,
  useMessages,
  useRegion,
  useSetLocale,
  useTranslations,
} from 'gt-react';

// ===== Functions ===== //
export {
  decodeMsg,
  decodeOptions,
  decodeVars,
  declareVar,
  derive,
  getDefaultLocale,
  getLocaleProperties,
  getLocales,
  resolveCanonicalLocale,
  getTranslationsSnapshot,
  getVersionId,
  gtFallback,
  mFallback,
  msg,
} from 'gt-react';
export { isLocaleSupported } from './request/localeValidation';

// ===== Types ===== //
export type { GTTranslationOptions, RuntimeTranslationOptions } from 'gt-react';
export type { WithGTServerSideProps, WithGTStaticProps };
