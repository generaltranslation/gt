import { getI18nCache, setI18nCache } from 'gt-i18n/internal';
import type { I18nCacheCore } from 'gt-i18n/internal';
import type { Translation } from 'gt-i18n/types';
import type { ReactI18nCacheCore } from './ReactI18nCache';

// ===== I18n Cache ===== //

export function getReactI18nCache(): ReactI18nCacheCore {
  return getI18nCache() as ReactI18nCacheCore;
}

export function setReactI18nCache(i18nCache: ReactI18nCacheCore): void {
  setI18nCache(i18nCache as I18nCacheCore<Translation>);
}
