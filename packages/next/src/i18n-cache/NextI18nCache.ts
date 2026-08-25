import {
  getI18nCache,
  getI18nConfig,
  setI18nCache,
  type I18nCacheCore,
} from 'gt-i18n/internal';
import type { Locale } from 'gt-i18n/internal/types';
import type { Dictionary, Translation } from 'gt-i18n/types';
import type { ReactI18nCacheDependencies } from '@generaltranslation/react-core/pure';
import { ReactI18nCache, type ReactI18nCacheParams } from 'gt-react';
import { getDictionary } from '../dictionary/getDictionary';
import { resolveDictionaryLoader } from '../resolvers/resolveDictionaryLoader';

export function getNextI18nCache(): NextI18nCache {
  return getI18nCache() as NextI18nCache;
}

export function setNextI18nCache(i18nCache: NextI18nCache): void {
  setI18nCache(i18nCache as I18nCacheCore<Translation>);
}

export type NextI18nCacheParams = ReactI18nCacheParams;

export class NextI18nCache extends ReactI18nCache {
  constructor(
    params: ReactI18nCacheParams,
    dependencies?: ReactI18nCacheDependencies
  ) {
    const loadDictionary = params.loadDictionary ?? resolveDictionaryLoader();
    super(
      {
        ...params,
        dictionary: params.dictionary ?? getDictionary() ?? {},
        ...(loadDictionary && {
          loadDictionary: async (locale: string) =>
            ((await loadDictionary(locale)) || {}) as Dictionary,
        }),
      },
      dependencies
    );
  }

  async loadDictionaries(locale: Locale): Promise<Record<Locale, Dictionary>> {
    return {
      [locale]: await this.loadDictionary(locale),
      ...(locale !== getI18nConfig().getDefaultLocale() && {
        [getI18nConfig().getDefaultLocale()]: getDictionary() || {},
      }),
    };
  }
}
