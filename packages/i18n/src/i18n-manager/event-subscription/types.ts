import type { Translation } from '../translations-manager/utils/types/translation-data';
import type { Hash } from '../translations-manager/TranslationsCache';
import type { Locale } from '../translations-manager/LocalesCache';
import type { BaseEvent } from './EventEmitter';

/**
 * A base event for the I18nManagers
 * @prop {locale-update} - Emitted when the locale is updated
 * @prop {locales-cache-hit} - Emitted when a locale cache hit occurs
 * @prop {locales-cache-miss} - Emitted when a locale cache miss occurs
 * @prop {translations-cache-hit} - Emitted when a translations cache hit occurs
 * @prop {translations-cache-miss} - Emitted when a translations cache miss occurs
 */
export type I18nEvents<TranslationValue extends Translation> = BaseEvent & {
  'locale-update': {
    previousLocale?: Locale;
    newLocale: Locale;
  };
  'locales-cache-hit': {
    locale: Locale;
    translations: Record<Hash, TranslationValue>;
  };
  'locales-cache-miss': {
    locale: Locale;
    translations: Record<Hash, TranslationValue>;
  };
  'translations-cache-hit': {
    locale: Locale;
    hash: Hash;
    translation: TranslationValue;
  };
  'translations-cache-miss': {
    locale: Locale;
    hash: Hash;
    translation: TranslationValue;
  };
};
