import { EventEmitter } from '../event-subscription/EventEmitter';
import {
  DICTIONARY_CACHE_MISS_EVENT_NAME,
  LOCALES_CACHE_MISS_EVENT_NAME,
  LOCALES_DICTIONARY_CACHE_MISS_EVENT_NAME,
  TRANSLATIONS_CACHE_MISS_EVENT_NAME,
} from '../event-subscription/types';
import type { Translation } from '../translations-manager/utils/types/translation-data';
import type { I18nManagerCacheLifecycleCallbacks } from './types';
import type { I18nEvents } from '../event-subscription/types';
/**
 * Maps consumer-facing lifecycle callbacks to internal locales cache lifecycle callbacks.
 * The consumer API exposes simplified params (locale, hash, value) while the internal
 * API uses the full cache lifecycle params (inputKey, cacheKey, cacheValue, outputValue).
 *
 * @deprecated - move to subscription api instead
 */
export function createLifecycleCallbacks<TranslationValue extends Translation>(
  emit: EventEmitter<I18nEvents<TranslationValue>>['emit'],
  hasListeners: <EventName extends keyof I18nEvents<TranslationValue>>(
    eventName: EventName
  ) => boolean = () => true
): I18nManagerCacheLifecycleCallbacks<TranslationValue> {
  return {
    onLocalesCacheHit: (params) => {
      if (!hasListeners('locales-cache-hit')) {
        return;
      }
      emit('locales-cache-hit', {
        locale: params.inputKey,
        translations: params.outputValue.getInternalCache(),
      });
    },
    onLocalesCacheMiss: (params) => {
      if (!hasListeners(LOCALES_CACHE_MISS_EVENT_NAME)) {
        return;
      }
      emit(LOCALES_CACHE_MISS_EVENT_NAME, {
        locale: params.inputKey,
        translations: params.outputValue.getInternalCache(),
      });
    },
    onTranslationsCacheHit: (params) => {
      emit('translations-cache-hit', {
        locale: params.locale,
        hash: params.cacheKey,
        translation: params.outputValue,
      });
    },
    onTranslationsCacheMiss: (params) => {
      emit(TRANSLATIONS_CACHE_MISS_EVENT_NAME, {
        locale: params.locale,
        hash: params.cacheKey,
        translation: params.outputValue,
      });
    },
    onLocalesDictionaryCacheHit: (params) => {
      if (!hasListeners('locales-dictionary-cache-hit')) {
        return;
      }
      emit('locales-dictionary-cache-hit', {
        locale: params.inputKey,
        dictionary: params.outputValue.getInternalCache(),
      });
    },
    onLocalesDictionaryCacheMiss: (params) => {
      if (!hasListeners(LOCALES_DICTIONARY_CACHE_MISS_EVENT_NAME)) {
        return;
      }
      emit(LOCALES_DICTIONARY_CACHE_MISS_EVENT_NAME, {
        locale: params.inputKey,
        dictionary: params.outputValue.getInternalCache(),
      });
    },
    onDictionaryCacheHit: (params) => {
      emit('dictionary-cache-hit', {
        locale: params.locale,
        id: params.cacheKey,
        dictionaryEntry: params.outputValue,
      });
    },
    onDictionaryCacheMiss: (params) => {
      emit(DICTIONARY_CACHE_MISS_EVENT_NAME, {
        locale: params.locale,
        id: params.cacheKey,
        dictionaryEntry: params.outputValue,
      });
    },
    onDictionaryObjectCacheHit: (params) => {
      emit('dictionary-object-cache-hit', {
        locale: params.locale,
        id: params.cacheKey,
        dictionaryValue: params.outputValue,
      });
    },
  };
}
