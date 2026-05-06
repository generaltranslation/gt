import { EventEmitter } from '../event-subscription/EventEmitter';
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
  emit: EventEmitter<I18nEvents<TranslationValue>>['emit']
): I18nManagerCacheLifecycleCallbacks<TranslationValue> {
  return {
    onLocalesCacheHit: (params) => {
      emit('locales-cache-hit', {
        locale: params.inputKey,
        translations: params.outputValue.getInternalCache(),
      });
    },
    onLocalesCacheMiss: (params) => {
      emit('locales-cache-miss', {
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
      emit('translations-cache-miss', {
        locale: params.locale,
        hash: params.cacheKey,
        translation: params.outputValue,
      });
    },
    onLocalesDictionaryCacheHit: (params) => {
      emit('locales-dictionary-cache-hit', {
        locale: params.inputKey,
        dictionary: params.outputValue.getInternalCache(),
      });
    },
    onLocalesDictionaryCacheMiss: (params) => {
      emit('locales-dictionary-cache-miss', {
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
    // Reserved for the future fallback-backed dictionary miss path. Current
    // lookupDictionary() misses use DictionaryCache.get(), which is silent.
    onDictionaryCacheMiss: (params) => {
      emit('dictionary-cache-miss', {
        locale: params.locale,
        id: params.cacheKey,
        dictionaryEntry: params.outputValue,
      });
    },
  };
}
