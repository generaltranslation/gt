import 'server-only';

import { T } from './server-dir/buildtime/T';
import { tx } from './server-dir/runtime/tx';
import { getLocale } from './request/getLocale';
import { registerLocale } from './request/registerLocale';
import { getRegion } from './request/getRegion';
import { getI18NConfig } from './config-dir/getI18NConfig';
import { getTranslations } from './server-dir/buildtime/getTranslations';
import { GTProvider } from './provider/GTProvider';
import { Tx } from './server-dir/runtime/_Tx';
import type { LocaleProperties } from '@generaltranslation/format/types';
import { getLocaleDirection } from './request/getLocaleDirection';
import {
  getMessages,
  getGT,
} from './server-dir/buildtime/getTranslationFunction';
import { getI18nConfig } from 'gt-i18n/internal';

export function getDefaultLocale(): string {
  getI18NConfig(); // ensure the i18n config singleton is initialized
  return getI18nConfig().getDefaultLocale();
}

export function getGTClass() {
  return getI18NConfig().getGTClass();
}

export function getLocaleProperties(locale: string): LocaleProperties {
  return getGTClass().getLocaleProperties(locale);
}

export function getLocales(): string[] {
  getI18NConfig(); // ensure the i18n config singleton is initialized
  return getI18nConfig().getLocales();
}

export function getVersionId(): string | undefined {
  return getI18NConfig().getVersionId();
}

export {
  msg,
  decodeMsg,
  decodeOptions,
  derive,
  declareVar,
  decodeVars,
} from 'gt-i18n';

export {
  GTProvider,
  T,
  getGT,
  getTranslations,
  getMessages,
  tx,
  Tx,
  getLocale,
  registerLocale,
  getRegion,
  getLocaleDirection,
};
