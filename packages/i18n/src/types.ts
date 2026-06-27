// Translation functions
export type {
  DictionaryObjectTranslation,
  SyncResolutionFunction,
  SyncResolutionFunctionWithFallback,
  GTFunctionType,
  MFunctionType,
  TFunctionType,
  ResolveJsxTranslationFunction,
} from './translation-functions/types/functions';
export type { RegisterableMessages } from './translation-functions/types/message';
export type {
  BaseTranslationOptions,
  DictionaryTranslationOptions,
  DictionaryOptions,
  InlineTranslationOptionsFields,
  InlineTranslationOptions,
  InlineResolveOptions,
  EncodedTranslationOptions,
  RuntimeTranslationOptions,
  JsxTranslationOptions,
  LookupOptions,
  DictionaryLookupOptions,
  ResolutionOptions,
  NormalizedLookupOptions,
} from './translation-functions/types/options';
export type { Translation } from './i18n-cache/translations-manager/utils/types/translation-data';
export type {
  Dictionary,
  DictionaryEntry,
  DictionaryLeaf,
  DictionaryObject,
  DictionaryOptions,
  DictionaryValue,
  DictionaryPath,
  DictionaryKey,
} from './i18n-cache/translations-manager/DictionaryCache';
