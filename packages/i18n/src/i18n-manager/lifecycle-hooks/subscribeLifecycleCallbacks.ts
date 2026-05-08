import { EventEmitter } from '../event-subscription/EventEmitter';
import {
  DICTIONARY_CACHE_MISS_EVENT_NAME,
  LOCALES_CACHE_MISS_EVENT_NAME,
  LOCALES_DICTIONARY_CACHE_MISS_EVENT_NAME,
  TRANSLATIONS_CACHE_MISS_EVENT_NAME,
} from '../event-subscription/types';
import type { Translation } from '../translations-manager/utils/types/translation-data';
import type { LifecycleCallbacks } from './types';
import type { I18nEvents } from '../event-subscription/types';

/**
 * Subscribes to the lifecycle callbacks and emits the events to the event emitter
 * @deprecated - move to subscription api instead
 *
 * NOTE: we do not have to worry about unsubscribe here as this is a deprecated api
 * and is only used internally
 */
export function subscribeLifecycleCallbacks<
  TranslationValue extends Translation,
>(
  {
    onLocalesCacheHit,
    onLocalesCacheMiss,
    onTranslationsCacheHit,
    onTranslationsCacheMiss,
    onLocalesDictionaryCacheHit,
    onLocalesDictionaryCacheMiss,
    onDictionaryCacheHit,
    onDictionaryCacheMiss,
    onDictionaryObjectCacheHit,
  }: LifecycleCallbacks<TranslationValue>,
  subscribe: EventEmitter<I18nEvents<TranslationValue>>['subscribe']
) {
  if (onLocalesCacheHit) {
    subscribe('locales-cache-hit', (event) => {
      onLocalesCacheHit({
        ...event,
        value: event.translations,
      });
    });
  }
  if (onLocalesCacheMiss) {
    subscribe(LOCALES_CACHE_MISS_EVENT_NAME, (event) => {
      onLocalesCacheMiss({
        ...event,
        value: event.translations,
      });
    });
  }
  if (onTranslationsCacheHit) {
    subscribe('translations-cache-hit', (event) => {
      onTranslationsCacheHit({
        ...event,
        value: event.translation,
      });
    });
  }
  if (onTranslationsCacheMiss) {
    subscribe(TRANSLATIONS_CACHE_MISS_EVENT_NAME, (event) => {
      onTranslationsCacheMiss({
        ...event,
        value: event.translation,
      });
    });
  }
  if (onLocalesDictionaryCacheHit) {
    subscribe('locales-dictionary-cache-hit', (event) => {
      onLocalesDictionaryCacheHit(event);
    });
  }
  if (onLocalesDictionaryCacheMiss) {
    subscribe(LOCALES_DICTIONARY_CACHE_MISS_EVENT_NAME, (event) => {
      onLocalesDictionaryCacheMiss(event);
    });
  }
  if (onDictionaryCacheHit) {
    subscribe('dictionary-cache-hit', (event) => {
      onDictionaryCacheHit(event);
    });
  }
  if (onDictionaryCacheMiss) {
    subscribe(DICTIONARY_CACHE_MISS_EVENT_NAME, (event) => {
      onDictionaryCacheMiss(event);
    });
  }
  if (onDictionaryObjectCacheHit) {
    subscribe('dictionary-object-cache-hit', (event) => {
      onDictionaryObjectCacheHit(event);
    });
  }
}
