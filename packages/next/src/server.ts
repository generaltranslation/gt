import 'server-only';

import T from './server-dir/buildtime/T';
import tx from './server-dir/runtime/tx';
import { getLocale } from './request/getLocale';
import getI18NConfig from './config-dir/getI18NConfig';
import { getTranslations } from './server-dir/buildtime/getTranslations';
import GTProvider from './provider/GTProvider';
import Tx from './server-dir/runtime/_Tx';
import { LocaleProperties } from 'generaltranslation/types';
import { getLocaleDirection } from './request/getLocaleDirection';
import {
  getMessages,
  getGT,
} from './server-dir/buildtime/getTranslationFunction';

export function getDefaultLocale(): string {
  return getI18NConfig().getDefaultLocale();
}

export function getGTClass() {
  return getI18NConfig().getGTClass();
}

export function getLocaleProperties(locale: string): LocaleProperties {
  return getGTClass().getLocaleProperties(locale);
}

export function getLocales(): string[] {
  return getI18NConfig().getLocales();
}

export {
  GTProvider,
  T,
  getGT,
  getTranslations,
  getMessages,
  tx,
  Tx,
  getLocale,
  getLocaleDirection,
};
