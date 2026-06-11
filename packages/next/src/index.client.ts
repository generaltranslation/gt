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
  initializeGT,
} from 'gt-react/context';
import {
  gtProviderUseClientError,
  txUseClientError,
} from './errors/createErrors';
import type {
  DictionaryTranslationOptions,
  InlineTranslationOptions,
  RuntimeTranslationOptions,
} from 'gt-react';
export { LocaleSelector } from 'gt-react/context';

const publicI18nConfigParams =
  process.env.NEXT_PUBLIC_GENERALTRANSLATION_I18N_CONFIG_PARAMS;

console.log('CSR')
console.log('CSR: publicI18nConfigParams', publicI18nConfigParams);

if (publicI18nConfigParams) {
  console.log('CSR: initializing GT');
  initializeGT(JSON.parse(publicI18nConfigParams));
}

// Mock <GTProvider> which throws an error
export function GTProvider() {
  throw new Error(gtProviderUseClientError);
}

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
  T,
  Var,
  Num,
  Currency,
  DateTime,
  RelativeTime,
  Derive,
  Branch,
  Plural,
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
