'use client';

import { initializeGT } from './setup/initGT';
import { serverEntrypointImportedInBrowserError } from './errors/createErrors';
initializeGT();

// Debugging statement, change to warn before publish
if (typeof window !== 'undefined') {
  console.warn(serverEntrypointImportedInBrowserError);
}

// ===== gt-react ===== //
export {
  // ----- components ----- //
  GTProvider,
  Var,
  Num,
  Currency,
  DateTime,
  RelativeTime,
  Derive,
  Branch,
  Plural,
  T,
  LocaleSelector,
  // ----- hooks ----- //
  useGT,
  useTranslations,
  useMessages,
  useSetLocale,
  useLocaleSelector,
  useLocale,
  useLocaleDirection,
  useVersionId,
  useLocales,
  useDefaultLocale,
  useGTClass,
  useLocaleProperties,
  // ----- functions ----- //
  msg,
  decodeMsg,
  decodeOptions,
  declareVar,
  decodeVars,
  derive,
  mFallback,
  gtFallback,
  getTranslationsSnapshot,
  getDefaultLocale,
  getGTClass,
  getLocaleProperties,
  getLocales,
  getVersionId,
} from 'gt-react/context';

export type {
  DictionaryTranslationOptions,
  InlineTranslationOptions,
  RuntimeTranslationOptions,
} from 'gt-react';
