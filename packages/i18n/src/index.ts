export {
  t,
  type TemplateSyncResolutionFunction,
} from './translation-functions/t';
export { msg } from './translation-functions/msg/msg';
export { decodeMsg } from './translation-functions/msg/decodeMsg';
export { decodeOptions } from './translation-functions/msg/decodeOptions';
export { derive, declareVar, decodeVars } from 'generaltranslation';
export { gtFallback } from './translation-functions/fallbacks/gtFallback';
export { mFallback } from './translation-functions/fallbacks/mFallback';
export {
  getLocale,
  getRegion,
  getLocales,
  getDefaultLocale,
  getLocaleProperties,
  resolveCanonicalLocale,
} from './helpers/locale';
export { getVersionId } from './helpers/versionId';

// Translation functions
export type {
  SyncResolutionFunction,
  SyncResolutionFunctionWithFallback,
  GTFunctionType,
  MFunctionType,
} from './translation-functions/types/functions';
export type { RegisterableMessages } from './translation-functions/types/message';
export type { Message } from './translation-functions/internal/getGT';
export type {
  TranslationVariables,
  GTTranslationOptions,
  EncodedTranslationOptions,
  JsxTranslationOptions,
  LookupOptionsFor,
  RuntimeTranslationOptions,
} from './translation-functions/types/options';
export type { Translation } from './i18n-cache/translations-manager/utils/types/translation-data';
