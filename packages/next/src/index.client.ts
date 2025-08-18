'use client';

import {
  Var,
  Num,
  Currency,
  DateTime,
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
} from 'gt-react/client';
import {
  gtProviderUseClientError,
  txUseClientError,
} from './errors/createErrors';
import {
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
  DictionaryTranslationOptions,
  InlineTranslationOptions,
  RuntimeTranslationOptions,
};
