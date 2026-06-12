'use client';
console.log('CSR - index.client.ts');

import { initializeGT } from './setup/initializeGTNext';
const publicI18nConfigParams =
  process.env.NEXT_PUBLIC_GENERALTRANSLATION_I18N_CONFIG_PARAMS;
if (publicI18nConfigParams) {
  console.log('CSR: initializing GT');
  initializeGT();
} else {
  console.warn('CSR: no initialize GT');
}

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
  msg,
  decodeMsg,
  decodeOptions,
  derive,
  declareVar,
  decodeVars,
  mFallback,
  gtFallback,
  getTranslationsSnapshot,
} from 'gt-react/context';
import {
  txUseClientError,
} from './errors/createErrors';
import type {
  DictionaryTranslationOptions,
  InlineTranslationOptions,
  RuntimeTranslationOptions,
} from 'gt-react';

// Mock <Tx> which throws an error
export function Tx() {
  throw new Error(txUseClientError);
}

function useGTClass() {
  throw new Error('useGTClass() is not yet implemented in the client');
}
function useLocaleProperties() {
  throw new Error('useLocaleProperties() is not yet implemented in the client');
}
function useLocaleDirection() {
  throw new Error('useLocaleDirection() is not yet implemented in the client');
}
function useVersionId() {
  throw new Error('useVersionId() is not yet implemented in the client');
}

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
};
export type {
  DictionaryTranslationOptions,
  InlineTranslationOptions,
  RuntimeTranslationOptions,
};
