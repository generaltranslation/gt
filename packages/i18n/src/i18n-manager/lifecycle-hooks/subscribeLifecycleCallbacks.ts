import { EventEmitter } from '../event-subscription/EventEmitter';
import type { Translation } from '../translations-manager/utils/types/translation-data';
import type { LifecycleCallbacks } from './types';
// TODO: this is circular dependency, fix this
import type { I18nEvents } from '../I18nManager';

/**
 * Subscribes to the lifecycle callbacks and emits the events to the event emitter
 */
export function subscribeLifecycleCallbacks<
  TranslationValue extends Translation,
>(
  {
    onLocalesCacheHit,
    onLocalesCacheMiss,
    onTranslationsCacheHit,
    onTranslationsCacheMiss,
  }: LifecycleCallbacks<TranslationValue>,
  subscribe: EventEmitter<I18nEvents<TranslationValue>>['subscribe']
) {
  if (onLocalesCacheHit) {
    subscribe('locales-cache-hit', (event) => {
      onLocalesCacheHit({
        locale: event.locale,
        value: event.translations,
      });
    });
  }
  if (onLocalesCacheMiss) {
    subscribe('locales-cache-miss', (event) => {
      onLocalesCacheMiss({
        locale: event.locale,
        value: event.translations,
      });
    });
  }
  if (onTranslationsCacheHit) {
    subscribe('translations-cache-hit', (event) => {
      onTranslationsCacheHit({
        locale: event.locale,
        hash: event.hash,
        value: event.translation,
      });
    });
  }
  if (onTranslationsCacheMiss) {
    subscribe('translations-cache-miss', (event) => {
      onTranslationsCacheMiss({
        locale: event.locale,
        hash: event.hash,
        value: event.translation,
      });
    });
  }
}
