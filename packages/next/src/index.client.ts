'use client';
console.log('CSR - index.client.ts');

import { initializeGT } from './setup/initGT';
console.log('CSR: initializing GT');
initializeGT();

// Debugging statement, change to warn before publish
if (typeof window === 'undefined') {
  console.warn('CSR: being imported in server environment!');
  throw new Error('CSR: being imported in server environment!');
}

import { T } from 'gt-react/context';
(T as any)._gtt_marker = 'index.client.ts';
export { T };
import {
  Var,
  Num,
  Currency,
  DateTime,
  RelativeTime,
  Derive,
  // T,
  Branch,
  Plural,
  LocaleSelector,
  GTProvider,
  useGT,
  useTranslations,
  useLocale,
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
} from 'gt-react/context';
import type {
  DictionaryTranslationOptions,
  InlineTranslationOptions,
  RuntimeTranslationOptions,
} from 'gt-react';

export {
  // T,
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
};
