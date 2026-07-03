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

export { getPluralBranch } from './utils/plurals/getPluralBranch';
export { addGTIdentifier } from './utils/internal/addGTIdentifier';
export { writeChildrenAsObjects } from './utils/internal/writeChildrenAsObjects';
export { flattenDictionary } from './utils/dictionaries/flattenDictionary';
export { getVariableProps } from './utils/variables/_getVariableProps';
export { getVariableName } from './utils/variables/getVariableName';
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
export {
  defaultEnableI18nCookieName,
  defaultLocaleCookieName,
  defaultRegionCookieName,
  defaultResetLocaleCookieName,
} from './setup/i18nConfig';
export {
  getDictionaryEntry,
  isValidDictionaryEntry,
} from './utils/dictionaries/getDictionaryEntry';
export { getEntryAndMetadata } from './utils/dictionaries/getEntryAndMetadata';
export { mergeDictionaries } from './utils/dictionaries/mergeDictionaries';
export { getDefaultRenderSettings } from './utils/rendering/getDefaultRenderSettings';
export { isDictionaryEntry } from './utils/dictionaries/isDictionaryEntry';

export type {
  CustomLoader,
  Dictionary,
  DictionaryContent,
  DictionaryEntry,
  DictionaryObject,
  GTTranslationOptions,
  Entry,
  FlattenedDictionary,
  GTFunctionType,
  GTProp,
  LocalesDictionary,
  MFunctionType,
  Metadata,
  RenderMethod,
  RuntimeTranslationOptions,
  TranslatedChildren,
  Translations,
  VariableProps,
  _Message,
  _Messages,
  RelativeTimeFormatOptions,
  RenderVariable,
} from './utils/types';

export {
  internalInitializeGTSRA,
  internalInitializeGTSRA as initializeGT,
} from './setup/initializeGTSRA';

export {
  ReactI18nCache,
  type ReactI18nCacheParams,
} from './i18n-cache/ReactI18nCache';
export {
  getI18nStore,
  setI18nStore,
  isI18nStoreInitialized,
} from './i18n-store/singleton-operations';
export { I18nStore } from './i18n-store/I18nStore';
export {
  getI18nConfig,
  initializeI18nConfig,
  ReactI18nConfig,
  setI18nConfig,
} from './setup/i18nConfig';
export {
  getReadonlyConditionStoreWithFallback,
  setReadonlyConditionStore,
} from './condition-store/singleton-operations';
export {
  ReadonlyConditionStore,
  WritableConditionStore,
} from 'gt-i18n/internal';
export type { WritableConditionStoreParams } from 'gt-i18n/internal/types';
export type { ReactI18nConfigParams as I18nConfigParams } from './setup/i18nConfig';
export type {
  OnMissingDictionaryObj,
  OnMissingDictionaryEntry,
  OnMissingTranslation,
} from './hooks/utils/missing-translation';
export type {
  DictionaryLookup,
  TranslateLookup,
} from './i18n-store/storeTypes';
export {
  getDefaultLocale,
  getGTClass,
  getLocaleProperties,
  getLocales,
  getVersionId,
} from 'gt-i18n';
