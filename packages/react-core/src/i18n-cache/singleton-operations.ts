import * as i18nInternal from 'gt-i18n/internal';
import type { I18nCache } from 'gt-i18n/internal';
import type { Translation } from 'gt-i18n/types';
import type { ReactI18nCache } from './ReactI18nCache';

// ===== I18n Cache ===== //

export function getReactI18nCache(): ReactI18nCache {
  return i18nInternal.getI18nCache() as ReactI18nCache;
}

export function setReactI18nCache(i18nCache: ReactI18nCache): void {
  i18nInternal.setI18nCache(i18nCache as I18nCache<Translation>);
}

/** @deprecated use getReactI18nCache instead */
export { getReactI18nCache as getReactI18nManager };
/** @deprecated use setReactI18nCache instead */
export { setReactI18nCache as setReactI18nManager };
