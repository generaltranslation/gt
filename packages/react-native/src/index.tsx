import GtReactNative from './NativeGtReactNative';

import { GTProvider } from './provider/GTProvider';
export function multiply(a: number, b: number): number {
  return GtReactNative.multiply(a, b);
}

import {
  T,
  useGT,
  useTranslations,
  useDefaultLocale,
  useLocale,
  useRegion,
  Var,
  Num,
  Currency,
  DateTime,
  Plural,
  Branch,
  useLocales,
  useLocaleSelector,
  useSetLocale,
  useGTClass,
  useLocaleProperties,
  useRegionSelector,
  useLocaleDirection,
  useMessages,
  msg,
  decodeMsg,
  decodeOptions,
  gtFallback,
  mFallback,
} from '@generaltranslation/react-core';
import type {
  DictionaryTranslationOptions,
  InlineTranslationOptions,
  RuntimeTranslationOptions,
} from '@generaltranslation/react-core/types';

export {
  Var,
  Num,
  Currency,
  DateTime,
  T,
  GTProvider,
  Plural,
  Branch,
  useGT,
  useTranslations,
  useDefaultLocale,
  useLocale,
  useLocales,
  useSetLocale,
  useLocaleSelector,
  useRegion,
  useRegionSelector,
  useGTClass,
  useLocaleProperties,
  useLocaleDirection,
  type DictionaryTranslationOptions,
  type InlineTranslationOptions,
  type RuntimeTranslationOptions,
  msg,
  decodeMsg,
  decodeOptions,
  useMessages,
  gtFallback,
  mFallback,
};
