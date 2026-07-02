export {
  t,
  type TemplateSyncResolutionFunction,
} from './translation-functions/t';
export { msg } from './translation-functions/msg/msg';
export { decodeMsg } from './translation-functions/msg/decodeMsg';
export { decodeOptions } from './translation-functions/msg/decodeOptions';
export { derive, declareVar, decodeVars } from 'generaltranslation/internal';
export { gtFallback } from './translation-functions/fallbacks/gtFallback';
export { mFallback } from './translation-functions/fallbacks/mFallback';
export {
  getLocale,
  getRegion,
  getLocales,
  getDefaultLocale,
  getLocaleProperties,
} from './helpers/locale';
export { getVersionId } from './helpers/versionId';
