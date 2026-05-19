'use client';

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
  useGT,
  useTranslations,
  useLocale,
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
} from 'gt-react/client';
import {
  gtProviderUseClientError,
  txUseClientError,
} from './errors/createErrors';
import type {
  DictionaryTranslationOptions,
  InlineTranslationOptions,
  RuntimeTranslationOptions,
} from 'gt-react';

// Mock <GTProvider> which throws an error
export function GTProvider() {
  throw new Error(gtProviderUseClientError);
}

// Mock <Tx> which throws an error
export function Tx() {
  throw new Error(txUseClientError);
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
  LocaleSelector,
  RegionSelector,
  useGT,
  useTranslations,
  useLocale,
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
};
export type {
  DictionaryTranslationOptions,
  InlineTranslationOptions,
  RuntimeTranslationOptions,
};
