export { initializeGT } from './setup/initializeGT';
export { withGT } from './setup/withGT';
export { msg } from 'gt-i18n';
export { derive, declareVar, decodeVars } from 'generaltranslation';
export { decodeMsg, decodeOptions } from 'gt-i18n';
export { getGT, getMessages, tx } from 'gt-i18n/internal';
// shortcut: R5 compat glue, removed in R6 when GTProvider/initializeGT stop accepting dictionaries
export { getTranslations } from 'gt-i18n/internal';
export { getRequestLocale } from './helpers/getRequestLocale';
export {
  getDefaultLocale,
  getLocale,
  getLocaleProperties,
  getLocales,
  getVersionId,
} from 'gt-i18n';

export type {
  GTFunctionType,
  GTTranslationOptions,
  MFunctionType,
  RuntimeTranslationOptions,
} from 'gt-i18n';
// shortcut: R5 compat glue, removed in R6 when GTProvider/initializeGT stop accepting dictionaries
export type { TFunctionType } from 'gt-i18n';
export type { InitializeGTParams } from './setup/types';
export type { GTConfig } from 'generaltranslation';
export type { TranslationsLoader } from 'gt-i18n/internal';
