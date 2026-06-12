// Hook-free helpers that can be shared by React runtime entrypoints and RSC
// entrypoints. Do not export modules from here that import React context,
// hooks, or component implementations.

export {
  msg,
  decodeMsg,
  decodeOptions,
  derive,
  declareVar,
  decodeVars,
  mFallback,
  gtFallback,
} from 'gt-i18n';

export { default as getPluralBranch } from './utils/plurals/getPluralBranch';
export { getFormatLocales } from './hooks/utils/getFormatLocales';

export type { RelativeTimeFormatOptions, RenderVariable } from './utils/types';

export {
  internalInitializeGTSRA as initializeGT,
} from './setup/initializeGTSRA';

export {
  ReactI18nCache,
  type ReactI18nCacheParams,
} from './i18n-cache/ReactI18nCache';

export {
  getDefaultLocale,
  getGTClass,
  getLocaleProperties,
  getLocales,
  getVersionId,
} from 'gt-i18n';