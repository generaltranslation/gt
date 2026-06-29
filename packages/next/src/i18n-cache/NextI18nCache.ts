import { getI18nCache, setI18nCache, type I18nCache } from 'gt-i18n/internal';
import type { Locale } from 'gt-i18n/internal/types';
import type { Dictionary, Translation } from 'gt-i18n/types';
import { isValidElement } from 'react';
import { ReactI18nCache, type ReactI18nCacheParams } from 'gt-react';
import {
  mergeDictionaries,
  type Dictionary as LegacyDictionary,
  type DictionaryEntry,
} from '@generaltranslation/react-core/pure';
import { getDictionary, getDictionaryEntry } from '../dictionary/getDictionary';
import { createDictionarySubsetError } from '../errors/createErrors';
import { resolveDictionaryLoader } from '../resolvers/resolveDictionaryLoader';

export function getNextI18nCache(): NextI18nCache {
  return getI18nCache() as NextI18nCache;
}

export function isNextI18nCacheInitialized(): boolean {
  try {
    getNextI18nCache();
    return true;
  } catch {
    return false;
  }
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
    const dictionaryTranslations = await this.loadDictionary(locale);

    let dictionary: LegacyDictionary | DictionaryEntry =
      (prefixId ? getDictionaryEntry(prefixId) : await getDictionary()) || {};

    if (
      isValidElement(dictionary) ||
      Array.isArray(dictionary) ||
      typeof dictionary !== 'object'
    ) {
      throw new Error(
        createDictionarySubsetError(prefixId ?? '', '<GTProvider>')
      );
    }

    if (prefixId) {
      const prefixPath = prefixId.split('.').reverse();
      dictionary = prefixPath.reduce<LegacyDictionary>((acc, prefix) => {
        return { [prefix]: acc };
      }, dictionary as LegacyDictionary);
    }

    dictionary = mergeDictionaries(dictionary, dictionaryTranslations);

    return {
      [locale]: dictionary as unknown as Dictionary,
    };
  }
}
