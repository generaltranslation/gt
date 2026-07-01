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
export type { Message } from './translation-functions/internal/getGT';
export type {
  TranslationMetadata,
  TranslationOptions,
  TranslationVariables,
  GTTranslationOptions,
  DictionaryEntryOptions,
  EncodedTranslationOptions,
  JsxTranslationOptions,
  LookupOptionsFor,
  LookupOptions,
  NormalizedLookupOptions,
  RuntimeTranslationOptions,
} from './translation-functions/types/options';
export type { Translation } from './i18n-cache/translations-manager/utils/types/translation-data';
export type {
  Dictionary,
  DictionaryEntry,
  DictionaryLeaf,
  DictionaryObject,
  DictionaryValue,
  DictionaryPath,
  DictionaryKey,
} from './i18n-cache/translations-manager/DictionaryCache';
