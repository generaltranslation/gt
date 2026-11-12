// Hook-free helpers that can be shared by React runtime entrypoints and RSC
// entrypoints. Do not export modules from here that import React context,
// hooks, or component implementations.

export { getFormatLocales } from './hooks/utils/getFormatLocales';
export { getTranslationsSnapshot } from './functions/helpers/getTranslationsSnapshot';
export { t } from './functions/translation/t';
export { createRenderPipeline } from './utils/rendering/createRenderPipeline';
export type { RenderPipeline } from './utils/rendering/createRenderPipeline';
export type { RenderPreparedT } from './utils/translation/prepareT.shared';
export {
  getReactI18nCache,
  setReactI18nCache,
} from './i18n-cache/singleton-operations';
export { getDefaultRenderSettings } from './utils/rendering/getDefaultRenderSettings';

export type {
  VariableProps,
  RelativeTimeFormatOptions,
  RenderMethod,
  RenderVariable,
} from './utils/types';

export {
  internalInitializeGTSRA,
  type ReactInitializeGTParams,
} from './setup/initializeGTSRA';

export {
  ReactI18nCache,
  type ReactI18nCacheParams,
} from './i18n-cache/ReactI18nCache';
export { setI18nStore } from './i18n-store/singleton-operations';
export { I18nStore } from './i18n-store/I18nStore';
export { getI18nConfig, initializeI18nConfig } from './setup/i18nConfig';
export { getReadonlyConditionStore } from './condition-store/singleton-operations';
export type { ReactI18nConfigParams as I18nConfigParams } from './setup/i18nConfig';
export type { OnMissingTranslation } from './hooks/utils/missing-translation';
