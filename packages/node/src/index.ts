export { initializeGT } from './setup/initializeGT';
export { withGT } from './setup/withGT';
export { getGT, getMessages } from './translation-functions/getGT';
export { tx } from './translation-functions/tx';
export { dyn } from 'gt-i18n/internal';
export {
  date,
  derive,
  mFallback,
  msg,
  n,
  number,
  part,
  plural,
  select,
  selectordinal,
  time,
} from 'gt-i18n';
export { getRequestLocale } from './helpers/getRequestLocale';
export {
  getDefaultLocale,
  getLocale,
  getLocaleProperties,
  getLocales,
  getVersionId,
} from 'gt-i18n';

export type { GT, GTOptions, M, Msg, Part, Placeholder } from 'gt-i18n';
export type { InitializeGTParams } from './setup/types';
export type { GTConfig } from 'generaltranslation';
export type { TranslationsLoader } from 'gt-i18n/internal';
