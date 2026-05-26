import type { Translation } from '../translations-manager/utils/types/translation-data';
import type { Hash } from '../translations-manager/TranslationsCache';
import type { Locale } from '../translations-manager/LocalesCache';
import type {
  Dictionary,
  DictionaryEntry,
  DictionaryPath,
  DictionaryValue,
} from '../translations-manager/DictionaryCache';

export type EventName = string;

export type BaseEvent = Record<EventName, unknown>;

export type Listener<
  Events extends BaseEvent,
  EventName extends keyof Events = keyof Events,
> = (event: Events[EventName]) => void;

export type ListenerStore<Events extends BaseEvent> = Partial<{
  [EventName in keyof Events]: Set<Listener<Events, EventName>>;
}>;

export const LOCALES_CACHE_HIT_EVENT_NAME = 'locales-cache-hit';
export const LOCALES_CACHE_MISS_EVENT_NAME = 'locales-cache-miss';
export const TRANSLATIONS_CACHE_HIT_EVENT_NAME = 'translations-cache-hit';
export const TRANSLATIONS_CACHE_MISS_EVENT_NAME = 'translations-cache-miss';
export const LOCALES_DICTIONARY_CACHE_HIT_EVENT_NAME =
  'locales-dictionary-cache-hit';
export const LOCALES_DICTIONARY_CACHE_MISS_EVENT_NAME =
  'locales-dictionary-cache-miss';
export const DICTIONARY_CACHE_HIT_EVENT_NAME = 'dictionary-cache-hit';
export const DICTIONARY_CACHE_MISS_EVENT_NAME = 'dictionary-cache-miss';
export const DICTIONARY_OBJECT_CACHE_HIT_EVENT_NAME =
  'dictionary-object-cache-hit';

/**
 * A base event for the I18nCaches
 * @prop {locales-cache-hit} - Emitted when a locale cache hit occurs
 * @prop {locales-cache-miss} - Emitted when a locale cache miss occurs
 * @prop {translations-cache-hit} - Emitted when a translations cache hit occurs
 * @prop {translations-cache-miss} - Emitted when a translations cache miss occurs
 * @prop {locales-dictionary-cache-hit} - Emitted when a locales dictionary cache hit occurs
 * @prop {locales-dictionary-cache-miss} - Emitted when a locales dictionary cache miss occurs
 * @prop {dictionary-cache-hit} - Emitted when a dictionary cache hit occurs
 * @prop {dictionary-cache-miss} - Emitted when a dictionary cache miss occurs
 * @prop {dictionary-object-cache-hit} - Emitted when a dictionary object cache hit occurs
 */
export type I18nEvents<TranslationValue extends Translation> = BaseEvent & {
  [LOCALES_CACHE_HIT_EVENT_NAME]: {
    locale: Locale;
    translations: Record<Hash, TranslationValue>;
  };
  [LOCALES_CACHE_MISS_EVENT_NAME]: {
    locale: Locale;
    translations: Record<Hash, TranslationValue>;
  };
  [TRANSLATIONS_CACHE_HIT_EVENT_NAME]: {
    locale: Locale;
    hash: Hash;
    translation: TranslationValue;
  };
  [TRANSLATIONS_CACHE_MISS_EVENT_NAME]: {
    locale: Locale;
    hash: Hash;
    translation: TranslationValue;
  };
  [LOCALES_DICTIONARY_CACHE_HIT_EVENT_NAME]: {
    locale: Locale;
    dictionary: Dictionary;
  };
  [LOCALES_DICTIONARY_CACHE_MISS_EVENT_NAME]: {
    locale: Locale;
    dictionary: Dictionary;
  };
  [DICTIONARY_CACHE_HIT_EVENT_NAME]: {
    locale: Locale;
    id: DictionaryPath;
    dictionaryEntry: DictionaryEntry;
  };
  [DICTIONARY_CACHE_MISS_EVENT_NAME]: {
    locale: Locale;
    id: DictionaryPath;
    dictionaryEntry: DictionaryEntry;
  };
  [DICTIONARY_OBJECT_CACHE_HIT_EVENT_NAME]: {
    locale: Locale;
    id: DictionaryPath;
    dictionaryValue: DictionaryValue;
  };
};
