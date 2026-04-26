import type { Translation } from '../translations-manager/utils/types/translation-data';
import type {
  LifecycleCallbacks,
  LocalesCacheLifecycleCallbacks,
} from './types';

/**
 * Maps consumer-facing lifecycle callbacks to internal locales cache lifecycle callbacks.
 * The consumer API exposes simplified params (locale, hash, value) while the internal
 * API uses the full cache lifecycle params (inputKey, cacheKey, cacheValue, outputValue).
 *
 * @deprecated - move to subscription api instead
 */
export function createLifecycleCallbacks<TranslationValue extends Translation>({
  onLocalesCacheHit,
  onLocalesCacheMiss,
  onTranslationsCacheHit,
  onTranslationsCacheMiss,
}: LifecycleCallbacks<TranslationValue>): LocalesCacheLifecycleCallbacks<TranslationValue> {
  return {
    onLocalesCacheHit: (params) => {
      onLocalesCacheHit?.({
        locale: params.inputKey,
        value: params.outputValue.getInternalCache(),
      });
    },
    onLocalesCacheMiss: (params) => {
      onLocalesCacheMiss?.({
        locale: params.inputKey,
        value: params.outputValue.getInternalCache(),
      });
    },
    onTranslationsCacheHit: (params) => {
      onTranslationsCacheHit?.({
        locale: params.locale,
        hash: params.cacheKey,
        value: params.outputValue,
      });
    },
    onTranslationsCacheMiss: (params) => {
      onTranslationsCacheMiss?.({
        locale: params.locale,
        hash: params.cacheKey,
        value: params.outputValue,
      });
    },
  };
}
