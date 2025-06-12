import T from './server-dir/buildtime/T';
import tx from './server-dir/runtime/tx';
import { getLocale } from './request/getLocale';
import getI18NConfig from './config-dir/getI18NConfig';
import { getTranslations } from './server-dir/buildtime/getTranslations';
import GTProvider from './provider/GTProvider';
import Tx from './server-dir/runtime/_Tx';
import { getGT } from './server-dir/buildtime/getGT';
import { LocaleProperties } from 'generaltranslation/types';

export function getDefaultLocale(): string {
  return getI18NConfig().getDefaultLocale();
}

export function getGTClass() {
  return getI18NConfig().getGTClass();
}

export function getLocaleProperties(locale: string): LocaleProperties {
  return getGTClass().getLocaleProperties(locale);
}

export {
  GTProvider,
  T,
  getGT,
  tx,
  Tx,
  getLocale, // getDefaultLocale
  getTranslations,
  /**
   * @deprecated Use getTranslations instead
   */
  getTranslations as getDict,
};
