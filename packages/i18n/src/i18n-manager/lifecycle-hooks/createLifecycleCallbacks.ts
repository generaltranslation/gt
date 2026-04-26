import { EventEmitter } from '../event-subscription/EventEmitter';
import type { Translation } from '../translations-manager/utils/types/translation-data';
import type { LocalesCacheLifecycleCallbacks } from './types';
// TODO: this is circular dependency, fix this
import type { I18nEvents } from '../I18nManager';
/**
 * Maps consumer-facing lifecycle callbacks to internal locales cache lifecycle callbacks.
 * The consumer API exposes simplified params (locale, hash, value) while the internal
 * API uses the full cache lifecycle params (inputKey, cacheKey, cacheValue, outputValue).
 *
 * @deprecated - move to subscription api instead
 */
export function createLifecycleCallbacks<TranslationValue extends Translation>(
  emit: EventEmitter<I18nEvents<TranslationValue>>['emit']
): LocalesCacheLifecycleCallbacks<TranslationValue> {
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
  };
}
