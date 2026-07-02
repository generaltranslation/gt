// Ambient, request-scoped translation functions for .astro frontmatter and
// endpoints. The gt-astro middleware scopes each request's locale via
// AsyncLocalStorage, so these are safe to call anywhere in the request.
export { getGT, getMessages, getTranslations, tx } from 'gt-i18n/internal';
export {
  msg,
  decodeMsg,
  decodeOptions,
  derive,
  declareVar,
  decodeVars,
  getLocale,
  getRegion,
  getLocales,
  getDefaultLocale,
  getLocaleProperties,
  getVersionId,
  mFallback,
  gtFallback,
} from 'gt-i18n';

export { withGT } from './setup/withGT';
export {
  getGTProviderProps,
  type GTProviderIslandProps,
} from './functions/getGTProviderProps';
export { getLocalizedPath } from './utils/pathLocale';
export type { GTLocals } from './types';
