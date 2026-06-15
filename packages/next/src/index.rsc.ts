import 'server-only';

import { initializeGT } from './setup/initGT.rsc';
import type { GetServerSidePropsContext, PreviewData } from 'next';
import type { ParsedUrlQuery } from 'querystring';
initializeGT();

// ===== Overrides ===== //
import { GTProvider } from './provider/GTProvider';
import { Var } from './variables/Var';
import { Num } from './variables/Num';
import { Currency } from './variables/Currency';
import { DateTime } from './variables/DateTime';
import { RelativeTime } from './variables/RelativeTime';
import { T } from './server-dir/buildtime/T';
import { Branch } from './branches/Branch';
import { Plural } from './branches/Plural';
import { useLocale } from './request/getLocale';
import { useLocaleDirection } from './request/getLocaleDirection';

export {
  useTranslations,
  useMessages,
  useGT,
} from './server-dir/buildtime/strings';

// ===== Client Boundary ===== //

export { Client_LocaleSelector as LocaleSelector } from './utils/client-boundary';

// ===== gt-react ===== //
import {
  msg,
  decodeMsg,
  decodeOptions,
  declareVar,
  decodeVars,
  derive,
  Derive,
  mFallback,
  gtFallback,
  getDefaultLocale,
  getGTClass,
  getLocaleProperties,
  getLocales,
  getVersionId,
  // ----- hooks ----- //
  useGTClass,
  useLocaleProperties,
  useLocales,
  useDefaultLocale,
  useVersionId,
} from 'gt-react/context';
import type {
  DictionaryTranslationOptions,
  InlineTranslationOptions,
  RuntimeTranslationOptions,
} from 'gt-react';
import { getTranslationsSnapshotRscError } from './errors/createErrors';

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

export {
  GTProvider,
  T,
  Var,
  Num,
  Currency,
  DateTime,
  RelativeTime,
  Derive,
  Branch,
  Plural,
  useLocale,
  useLocaleDirection,
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
  useGTClass,
  useLocaleProperties,
  useLocales,
  useDefaultLocale,
  useVersionId,
};
export type {
  DictionaryTranslationOptions,
  InlineTranslationOptions,
  RuntimeTranslationOptions,
};
