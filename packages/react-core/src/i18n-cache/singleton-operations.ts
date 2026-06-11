import { getI18nCache, setI18nCache } from 'gt-i18n/internal';
import type { I18nCache } from 'gt-i18n/internal';
import type { Translation } from 'gt-i18n/types';
import type { ReactI18nCache } from './ReactI18nCache';

// ===== I18n Cache ===== //

export function getReactI18nCache(): ReactI18nCache {
  return getI18nCache() as ReactI18nCache;
}

export function setReactI18nCache(i18nCache: ReactI18nCache): void {
  setI18nCache(i18nCache as I18nCache<Translation>);
}
