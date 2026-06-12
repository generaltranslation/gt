import 'server-only';
console.log('RSC - index.rsc.ts');


import { initializeGT } from './setup/initGT';
console.log('RSC: initializing GT');
initializeGT();

// Debugging statement, change to warn before publish
if (typeof window !== 'undefined') {
  console.warn('RSC: being imported in browser environment!');
  throw new Error('RSC: being imported in browser environment!');
}


// ===== Overrides ===== //
import { GTProvider } from './provider/GTProvider';
import { Var } from './variables/Var';
import { Num } from './variables/Num';
import { Currency } from './variables/Currency';
import { DateTime } from './variables/DateTime';
import { RelativeTime } from './variables/RelativeTime';
import { T } from './server-dir/buildtime/T';
(T as any)._gtt_marker = 'index.rsc.ts';
import { Branch } from './branches/Branch';
import { Plural } from './branches/Plural';
import { useLocale } from './request/getLocale';
import { useLocaleDirection } from './request/getLocaleDirection';

export {
  useTranslations,
  useMessages,
  useGT
} from './server-dir/buildtime/strings';


// ===== Client Boundary ===== //

export {
  Client_LocaleSelector as LocaleSelector
} from './utils/client-boundary';

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


// ===== other ===== //

/**
 * Placeholder for getTranslationsSnapshot()
 * This function is for next-pages use, not next-app use
 */
export function getTranslationsSnapshot(_: string) {
  throw new Error('getTranslationsSnapshot() is not available for react-server components');
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
