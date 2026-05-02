import { EventEmitter } from '../event-subscription/EventEmitter';
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
    subscribe('locales-cache-miss', (event) => {
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
    subscribe('translations-cache-miss', (event) => {
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
    subscribe('locales-dictionary-cache-miss', (event) => {
      onLocalesDictionaryCacheMiss(event);
    });
  }
  if (onDictionaryCacheHit) {
    subscribe('dictionary-cache-hit', (event) => {
      onDictionaryCacheHit(event);
    });
  }
  if (onDictionaryCacheMiss) {
    subscribe('dictionary-cache-miss', (event) => {
      onDictionaryCacheMiss(event);
    });
  }
}
