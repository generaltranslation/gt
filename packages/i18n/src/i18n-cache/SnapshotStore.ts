import type { LookupOptions } from '../translation-functions/types/options';
import { hashMessage } from '../utils/hashMessage';
import { getI18nConfig } from '../i18n-config/singleton-operations';
import {
  cloneDictionaryValue,
  getDictionaryEntry,
  getDictionaryValueAtPath,
  isDictionaryValue,
  setDictionaryValueAtPath,
} from './translations-manager/utils/dictionary-helpers';
import type {
  Dictionary,
  DictionaryEntry,
  DictionaryObject,
  DictionaryValue,
} from './translations-manager/utils/types/dictionary';
import type { Hash, Locale } from './translations-manager/TranslationsCache';
import type { Translation } from './translations-manager/utils/types/translation-data';
import {
  resolveDictionaryCacheLocale,
  resolveLookupParams,
} from './utils/resolveCacheLocale';

/** Mutable translation snapshots with synchronous locale-aware lookup. */
export class SnapshotStore {
  private translations: Record<Locale, Record<Hash, Translation>> = {};
  private dictionaries: Record<Locale, Dictionary> = {};

  constructor(dictionary?: Dictionary) {
    if (dictionary) {
      const defaultLocale = getI18nConfig().getDefaultLocale();
      this.dictionaries[defaultLocale] = cloneDictionaryValue(dictionary);
    }
  }

  updateTranslations(
    translationsSnapshot: Record<Locale, Record<Hash, Translation>>
  ): void {
    for (const [locale, translations] of Object.entries(translationsSnapshot)) {
      this.translations[locale] = {
        ...this.translations[locale],
        ...structuredClone(translations),
      };
    }
  }

  updateDictionaries(dictionarySnapshot: Record<Locale, Dictionary>): void {
    for (const [locale, dictionary] of Object.entries(dictionarySnapshot)) {
      this.dictionaries[locale] ??= {};
      mergeDictionary(this.dictionaries[locale], dictionary);
    }
  }

  updateDictionaryValue(
    locale: Locale,
    id: string,
    value: DictionaryValue
  ): void {
    this.dictionaries[locale] ??= {};
    setDictionaryValueAtPath(
      this.dictionaries[locale],
      id,
      cloneDictionaryValue(value)
    );
  }

  getTranslations(locale: Locale): Record<Hash, Translation> | undefined {
    const translations = this.translations[locale];
    return translations ? structuredClone(translations) : undefined;
  }

  getDictionary(locale: Locale): Dictionary | undefined {
    const dictionary = this.dictionaries[locale];
    return dictionary ? cloneDictionaryValue(dictionary) : undefined;
  }

  lookupTranslation<T extends Translation>(
    locale: string,
    message: T,
    options: LookupOptions
  ): T | undefined {
    const { translationLocale, options: lookupOptions } = resolveLookupParams(
      locale,
      options
    );
    if (!translationLocale) return message;

    const hash = lookupOptions.$_hash ?? hashMessage(message, lookupOptions);
    return this.translations[translationLocale]?.[hash] as T | undefined;
  }

  lookupDictionary(locale: string, id: string): DictionaryEntry | undefined {
    return getDictionaryEntry(this.lookupDictionaryObj(locale, id));
  }

  lookupDictionaryObj(
    locale: string,
    id: string
  ): DictionaryObject | undefined {
    const dictionary = this.dictionaries[resolveDictionaryCacheLocale(locale)];
    if (!dictionary) return undefined;
    return cloneDictionaryValue(getDictionaryValueAtPath(dictionary, id));
  }
}

export type SnapshotStoreInstance = Pick<SnapshotStore, keyof SnapshotStore>;

function mergeDictionary(target: Dictionary, source: Dictionary): void {
  for (const [key, value] of Object.entries(source)) {
    const targetValue = target[key];
    if (isDictionaryValue(targetValue) && isDictionaryValue(value)) {
      mergeDictionary(targetValue, value);
    } else {
      target[key] = cloneDictionaryValue(value);
    }
  }
}
