import 'server-only';

// ===== Overrides ===== //
import { GTProvider } from './provider/GTProvider';
import { Var } from './variables/Var';
import { Num } from './variables/Num';
import { Currency } from './variables/Currency';
import { DateTime } from './variables/DateTime';
import { RelativeTime } from './variables/RelativeTime';
import { T } from './server-dir/buildtime/T';
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
  initializeGT,
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

const publicI18nConfigParams =
  process.env.NEXT_PUBLIC_GENERALTRANSLATION_I18N_CONFIG_PARAMS;

console.log('RSC')
console.log('RSC: publicI18nConfigParams', publicI18nConfigParams);

if (publicI18nConfigParams) {
  console.log('RSC: initializing GT');
  initializeGT(JSON.parse(publicI18nConfigParams));
}

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
