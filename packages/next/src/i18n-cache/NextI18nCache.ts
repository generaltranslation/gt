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
import { createDictionarySubsetError } from '../errors/createErrors';

export function getNextI18nCache(): NextI18nCache {
  return getI18nCache() as NextI18nCache;
}

export function setNextI18nCache(i18nCache: NextI18nCache): void {
  setI18nCache(i18nCache as I18nCache<Translation>);
}

export type NextI18nCacheParams = ReactI18nCacheParams;

export class NextI18nCache extends ReactI18nCache {
  constructor(params: ReactI18nCacheParams) {
    const explicitLoadDictionary = params.loadDictionary;
    super({
      ...params,
      dictionary: params.dictionary ?? {},
      loadDictionary: async (locale: string) => {
        let loadDictionary = explicitLoadDictionary;
        // `resolveDictionaryLoader` uses require() and is server-only. Resolve
        // it lazily behind a `typeof window` guard so bundlers drop it from the
        // client build (its createRequire shim breaks client chunking).
        if (loadDictionary === undefined && typeof window === 'undefined') {
          const { resolveDictionaryLoader } = await import(
            '../resolvers/resolveDictionaryLoader'
          );
          loadDictionary = resolveDictionaryLoader() as typeof loadDictionary;
        }
        if (!loadDictionary) return {} as Dictionary;
        return ((await loadDictionary(locale)) || {}) as Dictionary;
      },
    });
  }

  async loadDictionaries(
    locale: Locale,
    prefixId?: string
  ): Promise<Record<Locale, Dictionary>> {
    const dictionaryTranslations = await this.loadDictionary(locale);

    // `getDictionary` uses require() (server-only). Imported lazily behind a
    // `typeof window` guard so it stays out of the client build.
    let dictionary: LegacyDictionary | DictionaryEntry = {};
    if (typeof window === 'undefined') {
      const { getDictionary, getDictionaryEntry } = await import(
        '../dictionary/getDictionary'
      );
      dictionary =
        (prefixId ? getDictionaryEntry(prefixId) : await getDictionary()) || {};
    }

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
