import type { StringFormat } from '@generaltranslation/format/types';
import type { NormalizedLookupOptions } from './translation-functions/types/options';

export { getGT, getGTInternal } from './translation-functions/internal/getGT';
export {
  getMessages,
  getMessagesInternal,
} from './translation-functions/internal/getMessages';
export {
  getTranslations,
  getTranslationsInternal,
} from './translation-functions/internal/getTranslations';
export { tx, txInternal } from './translation-functions/internal/tx';
export {
  GtInternalRuntimeTranslateString,
  GtInternalRuntimeTranslateJsx,
} from './translation-functions/internal/runtime-translate';
export { createLookupOptions } from './translation-functions/internal/helpers';
export { renderDictionaryEntry } from './translation-functions/internal/renderDictionaryEntry';
export { renderDictionaryObject } from './translation-functions/internal/renderDictionaryObject';
export { I18nCache } from './i18n-cache/I18nCache';
export type { TranslationsCacheMissEvent } from './i18n-cache/I18nCache';
export { ReadonlyConditionStore } from './condition-store/ReadonlyConditionStore';
export type { ReadonlyConditionStoreParams } from './condition-store/ReadonlyConditionStore';
export { WritableConditionStore } from './condition-store/WritableConditionStore';
export type { WritableConditionStoreParams } from './condition-store/WritableConditionStore';
export type { LocaleCandidates } from './i18n-config/I18nConfig';
export { getI18nCache, setI18nCache } from './i18n-cache/singleton-operations';
export { getVersionId } from './helpers/versionId';
export { interpolateMessage } from './translation-functions/utils/interpolation/interpolateMessage';
export type InterpolationOptions = NormalizedLookupOptions<StringFormat>;
export { isEncodedTranslationOptions } from './translation-functions/utils/isEncodedTranslationOptions';
export { extractVariables } from './utils/extractVariables';
export {
  getDictionaryListenerKey,
  getTranslateListenerKey,
} from './utils/listenerKeys';
export type {
  DictionaryListenerLookup,
  TranslateListenerLookup,
} from './utils/listenerKeys';
export {
  getDictionaryEntry,
  isDictionaryValue,
  getDictionaryValue,
  resolveDictionaryLookupOptions,
} from './i18n-cache/translations-manager/utils/dictionary-helpers';

export {
  getI18nConfig,
  initializeI18nConfig,
  setI18nConfig,
} from './i18n-config/singleton-operations';
export { I18nConfig } from './i18n-config/I18nConfig';
export type { I18nConfigParams } from './i18n-config/I18nConfig';
export { createConditionStoreSingleton } from './condition-store/createConditionStoreSingleton';
export { createGlobalSingleton } from './globals/createGlobalSingleton';
export type { GlobalSingleton } from './globals/createGlobalSingleton';
export { getRuntimeEnvironment } from './utils/getRuntimeEnvironment';
export { hashMessage } from './utils/hashMessage';
export { getCookieValue, parseAcceptLanguage } from './utils/request';
