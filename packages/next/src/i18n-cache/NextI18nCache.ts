import { getI18nCache, setI18nCache, type I18nCache } from 'gt-i18n/internal';
import type { Locale } from 'gt-i18n/internal/types';
import type { Dictionary, Translation } from 'gt-i18n/types';
import { isValidElement } from 'react';
import { ReactI18nCache, type ReactI18nCacheParams } from 'gt-react';
import {
  getDictionaryEntry as getEntry,
  type Dictionary as LegacyDictionary,
  type DictionaryEntry,
} from '@generaltranslation/react-core/pure';
import { getDictionary, getDictionaryEntry } from '../dictionary/getDictionary';
import { createDictionarySubsetError } from '../errors/createErrors';
import { resolveDictionaryLoader } from '../resolvers/resolveDictionaryLoader';
import { getI18nConfig } from 'gt-i18n/internal';

export function getNextI18nCache(): NextI18nCache {
  return getI18nCache() as NextI18nCache;
}

export function setNextI18nCache(i18nCache: NextI18nCache): void {
  setI18nCache(i18nCache as I18nCache<Translation>);
}

export type NextI18nCacheParams = ReactI18nCacheParams;

export class NextI18nCache extends ReactI18nCache {
  constructor(params: ReactI18nCacheParams) {
    const loadDictionary = params.loadDictionary ?? resolveDictionaryLoader();
    super({
      ...params,
      ...(loadDictionary && {
        dictionary: params.dictionary ?? {},
        loadDictionary: async (locale: string) =>
          ((await loadDictionary(locale)) || {}) as Dictionary,
      }),
    });
  }

  async loadDictionaries(
    locale: Locale,
    prefixId?: string
  ): Promise<Record<Locale, Dictionary>> {
    const defaultLocale = getI18nConfig().getDefaultLocale();
    const sourceDictionary =
      (prefixId ? getDictionaryEntry(prefixId) : await getDictionary()) || {};

    const dictionaries: Record<Locale, Dictionary> = {
      [defaultLocale]: createDictionarySnapshot(
        sourceDictionary,
        prefixId,
        true
      ),
    };

    if (locale !== defaultLocale) {
      const targetDictionary = await this.loadDictionary(locale);
      dictionaries[locale] = createDictionarySnapshot(
        prefixId
          ? getEntry(targetDictionary as LegacyDictionary, prefixId)
          : targetDictionary,
        prefixId,
        false
      );
    }

    this.updateDictionaries(dictionaries);
    return dictionaries;
  }
}

function createDictionarySnapshot(
  dictionary: LegacyDictionary | DictionaryEntry | undefined,
  prefixId: string | undefined,
  throwOnInvalid: boolean
): Dictionary {
  let snapshot = dictionary;

  if (!isDictionaryObject(snapshot)) {
    if (throwOnInvalid) {
      throw new Error(
        createDictionarySubsetError(prefixId ?? '', '<GTProvider>')
      );
    }
    snapshot = {};
  }

  if (!prefixId) return snapshot as unknown as Dictionary;

  return prefixId
    .split('.')
    .reverse()
    .reduce<LegacyDictionary>((acc, prefix) => {
      return { [prefix]: acc };
    }, snapshot as LegacyDictionary) as unknown as Dictionary;
}

function isDictionaryObject(
  dictionary: LegacyDictionary | DictionaryEntry | undefined
): dictionary is LegacyDictionary {
  return (
    !!dictionary &&
    !isValidElement(dictionary) &&
    !Array.isArray(dictionary) &&
    typeof dictionary === 'object'
  );
}
