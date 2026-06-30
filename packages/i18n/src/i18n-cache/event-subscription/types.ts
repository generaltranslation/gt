import type { Hash } from '../translations-manager/TranslationsCache';
import type { Locale } from '../translations-manager/LocalesCache';
import type { Translation } from '../translations-manager/utils/types/translation-data';

export type EventMap = object;

export type Listener<
  Events extends EventMap,
  EventName extends keyof Events = keyof Events,
> = (event: Events[EventName]) => void;

export type ListenerStore<Events extends EventMap> = Partial<{
  [EventName in keyof Events]: Set<Listener<Events, EventName>>;
}>;

export const TRANSLATIONS_CACHE_MISS_EVENT_NAME = 'translations-cache-miss';

/**
 * Events emitted by the I18nCaches
 * @prop {translations-cache-miss} - Emitted when a translations cache miss occurs
 */
export type I18nEvents<TranslationValue extends Translation> = {
  [TRANSLATIONS_CACHE_MISS_EVENT_NAME]: {
    locale: Locale;
    hash: Hash;
    translation: TranslationValue;
  };
};
