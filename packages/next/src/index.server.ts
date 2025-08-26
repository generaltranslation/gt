import Var from './variables/Var';
import Num from './variables/Num';
import Currency from './variables/Currency';
import DateTime from './variables/DateTime';
import T from './server-dir/buildtime/T';
import Branch from './branches/Branch';
import Plural from './branches/Plural';
import GTProvider from './provider/GTProvider';
import { Tx } from './server';
import { useGT } from './server-dir/buildtime/getGT';
import { useTranslations } from './server-dir/buildtime/getTranslations';
import { useLocale } from './request/getLocale';
import { useLocaleDirection } from './request/getLocaleDirection';
import getI18NConfig from './config-dir/getI18NConfig';
import Msg from 'gt-react';
import {
  DictionaryTranslationOptions,
  InlineTranslationOptions,
  RuntimeTranslationOptions,
} from 'gt-react';
import { GT } from 'generaltranslation';

export { LocaleSelector, RegionSelector } from './index.client';

export function useGTClass() {
  return getI18NConfig().getGTClass();
}

export function useLocaleProperties(locale: string) {
  return (useGTClass() as GT).getLocaleProperties(locale);
}

export function useLocales() {
  return getI18NConfig().getLocales();
}

export function useDefaultLocale() {
  return getI18NConfig().getDefaultLocale();
}

export {
  GTProvider,
  T,
  Tx,
  Var,
  Num,
  Currency,
  DateTime,
  Branch,
  Plural,
  useGT,
  useTranslations,
  useLocale,
  useLocaleDirection,
  DictionaryTranslationOptions,
  InlineTranslationOptions,
  RuntimeTranslationOptions,
  Msg,
};
