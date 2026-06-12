import { getI18nCache, setI18nCache } from 'gt-i18n/internal';
import { ReactI18nCache, type ReactI18nCacheParams } from 'gt-react/context';

export function getNextI18nCache(): NextI18nCache {
  return getI18nCache() as NextI18nCache;
}

export function setNextI18nCache(i18nCache: NextI18nCache): void {
  setI18nCache(i18nCache);
}

export type NextI18nCacheParams = ReactI18nCacheParams;

export class NextI18nCache extends ReactI18nCache {
  constructor(params: ReactI18nCacheParams) {
    super(params);
  }
}
