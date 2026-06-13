'use client';

import { initializeGT } from './setup/initGT';
import { serverEntrypointImportedInBrowserError } from './errors/createErrors';
initializeGT();

// Debugging statement, change to warn before publish
if (typeof window !== 'undefined') {
  throw new Error(serverEntrypointImportedInBrowserError);
}

// ===== gt-react ===== //
import { T } from 'gt-react/context';
(T as any)._gtt_marker = 'index.server.ts';
export { T };
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
  // T,
  LocaleSelector,
  // ----- hooks ----- //
  useGT,
  useTranslations,
  useMessages,
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
