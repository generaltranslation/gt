"use client"
console.log('SSR - index.server.ts');

import { initializeGT } from './setup/initGT';
const publicI18nConfigParams =
  process.env.NEXT_PUBLIC_GENERALTRANSLATION_I18N_CONFIG_PARAMS;
if (publicI18nConfigParams) {
  console.log('SSR: initializing GT');
  initializeGT();
} else {
  console.warn('SSR: no initialize GT');
}

// Debugging statement, change to warn before publish
if (typeof window !== 'undefined') {
  console.warn('SSR: being imported in browser environment!');
  throw new Error('SSR: being imported in browser environment!');
}


// ===== Overrides ===== //
/**
 * @deprecated import from 'gt-next/server' instead
 */
export function Tx() {
  throw new Error('Tx is not available on the client');
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
