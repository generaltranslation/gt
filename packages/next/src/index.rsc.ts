import 'server-only';
console.log('RSC - index.rsc.ts');


import { initializeGT } from './setup/initializeGTNext';
const publicI18nConfigParams =
  process.env.NEXT_PUBLIC_GENERALTRANSLATION_I18N_CONFIG_PARAMS;
if (publicI18nConfigParams) {
  console.log('RSC: initializing GT');
  initializeGT();
} else {
  console.warn('RSC: no initialize GT');
}
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
import { Tx } from './server-dir/runtime/_Tx';
import { useTranslations } from './server-dir/buildtime/getTranslations';
import { useLocale } from './request/getLocale';
import { useLocaleDirection } from './request/getLocaleDirection';
import { getI18NConfig } from './config-dir/getI18NConfig';

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
} from 'gt-react/context';
import type {
  DictionaryTranslationOptions,
  InlineTranslationOptions,
  RuntimeTranslationOptions,
} from 'gt-react';

// ===== other ===== //
import { GT } from 'generaltranslation';
import {
  useMessages,
  useGT,
} from './server-dir/buildtime/getTranslationFunction';
import type { LocaleProperties } from '@generaltranslation/format/types';
import { Locale } from 'gt-i18n/src/i18n-cache/translations-manager/LocalesCache';


export { LocaleSelector } from 'gt-react/context';

export function useGTClass() {
  return getI18NConfig().getGTClass();
}

export function useLocaleProperties(locale: string): LocaleProperties {
  return (useGTClass() as GT).getLocaleProperties(locale);
}

export function useLocales() {
  return getI18NConfig().getLocales();
}

export function useDefaultLocale() {
  return getI18NConfig().getDefaultLocale();
}

export function useVersionId() {
  return getI18NConfig().getVersionId();
}

export function getTranslationsSnapshot(_: Locale) {
  throw new Error('getTranslationsSnapshot is not available in RSC');
}

export {
  GTProvider,
  T,
  /**
   * @deprecated import from 'gt-next/server' instead
   */
  Tx,
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
  useMessages,
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
};
export type {
  DictionaryTranslationOptions,
  InlineTranslationOptions,
  RuntimeTranslationOptions,
};
