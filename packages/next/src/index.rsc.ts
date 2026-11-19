import 'server-only';

import { initializeGTServer } from './setup/initGT.server';
import type {
  GetServerSideProps,
  GetServerSidePropsContext,
  PreviewData,
} from 'next';
import type { ParsedUrlQuery } from 'querystring';
import {
  getTranslationsSnapshotRscError,
  withGTStaticPropsRscError,
} from './errors/createErrors';
import type { WithGTServerSideProps } from './pages-dir/withGTServerSideProps';
import type {
  WithGTStaticProps,
  WithGTStaticPropsFunction,
} from './pages-dir/withGTStaticProps';
initializeGTServer();

// ===== Components ===== //
export { Currency } from './variables/Currency';
export { DateTime } from './variables/DateTime';
export { GTProvider } from './provider/GTProvider';
export { N } from './variables/N';
export { Num } from './variables/Num';
export { Plural } from './branches/Plural';
export { RelativeTime } from './variables/RelativeTime';
export { GtInternalTranslateJsx, T } from './server-dir/buildtime/T';
export { GtInternalVar, Var } from './variables/Var';

// ===== Hooks ===== //
export { useLocale } from './request/getLocale';
export { useRegion } from './request/getRegion';
export { useLocaleDirection } from './request/getLocaleDirection';
export { useLocalizeHref } from './link/getLocalizeHref';
export { useMessages, useGT } from './server-dir/buildtime/getGT';

// ===== Client Boundary ===== //

export { Client_LocaleSelector as LocaleSelector } from './utils/client-boundary';
export { Client_RegionSelector as RegionSelector } from './utils/client-boundary';

// ===== other ===== //

/**
 * Placeholder for getTranslationsSnapshot()
 * This function is for next-pages use, not next-app use
 */
export function getTranslationsSnapshot(_: string) {
  throw new Error(getTranslationsSnapshotRscError);
}

/**
 * Placeholder for parseLocale()
 * This function is for next-pages use, not next-app use
 */
export function parseLocale<
  Params extends ParsedUrlQuery = ParsedUrlQuery,
  Preview extends PreviewData = PreviewData,
>(_: GetServerSidePropsContext<Params, Preview>): string {
  throw new Error('parseLocale() is only available for the Pages Router.');
}

/**
 * Placeholder for withGTServerSideProps()
 * This function is for next-pages use, not next-app use
 */
export function withGTServerSideProps<
  Props extends Record<string, unknown> = Record<string, unknown>,
  Params extends ParsedUrlQuery = ParsedUrlQuery,
  Preview extends PreviewData = PreviewData,
>(
  _?: GetServerSideProps<Props, Params, Preview>
): GetServerSideProps<WithGTServerSideProps<Props>, Params, Preview> {
  throw new Error(
    'withGTServerSideProps() is only available for the Pages Router.'
  );
}

/**
 * Placeholder for withGTStaticProps()
 * This function is for next-pages use, not next-app use
 */
export const withGTStaticProps: WithGTStaticPropsFunction = () => {
  throw new Error(withGTStaticPropsRscError);
};

// ===== gt-react Components ===== //
export { Branch, Derive } from 'gt-react';

// ===== gt-react Hooks ===== //
export { useDefaultLocale, useLocaleProperties, useLocales } from 'gt-react';

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
export { isLocaleSupported } from './request/localeValidation';

// ===== Types ===== //
export type { GT, GTOptions, M, Msg, Part, Placeholder } from 'gt-i18n';
export type { WithGTServerSideProps, WithGTStaticProps };
