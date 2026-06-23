'use client';

import {
  useGTClass,
  useLocaleProperties,
  useLocaleDirection,
  useVersionId,
} from 'gt-react/client';
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
  useGT,
  useTranslations,
  useLocale,
  useLocales,
  useDefaultLocale,
  useMessages,
  msg,
  decodeMsg,
  decodeOptions,
  derive,
  declareVar,
  decodeVars,
  mFallback,
  gtFallback,
} from 'gt-react/context';
import { txUseClientError } from './errors/createErrors';
import type {
  DictionaryTranslationOptions,
  InlineTranslationOptions,
  RuntimeTranslationOptions,
} from 'gt-react';
export { PagesGTProvider as GTProvider } from './provider/PagesGTProvider';
export { getTranslationsSnapshot } from './config-dir/initializeGTNextContext';

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
