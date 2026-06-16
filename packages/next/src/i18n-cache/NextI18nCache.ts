import { getI18nCache, setI18nCache, I18nCache } from 'gt-i18n/internal';
import type { Translation } from 'gt-i18n/types';
import { ReactI18nCache, ReactI18nCacheParams } from 'gt-react/context';

export function getNextI18nCache(): I18nCache<Translation> {
  return getI18nCache() as I18nCache<Translation>;
}

export function setNextI18nCache(i18nCache: NextI18nCache): void {
  setI18nCache(i18nCache as I18nCache<Translation>);
}

export type NextI18nCacheParams = ReactI18nCacheParams;

export class NextI18nCache extends ReactI18nCache {
  constructor(params: ReactI18nCacheParams) {
    super(params);
  }
}
