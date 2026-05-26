import { I18nCache } from 'gt-i18n/internal';
import type { Translation } from 'gt-i18n/types';
import type { ReactI18nCacheParams } from '../i18n-cache/ReactI18nCache';
import { setRenderStrategy } from './globals';
import { setReactI18nCache } from '../i18n-cache/singleton-operations';

/**
 * Initialize GT for a server-side rendered application
 * - i18nCache
 *
 * ConditionStore and I18nStore are initialized in the provider at request time
 * TODO: auto detect if can find gt.config.json files
 */
export function internalInitializeGTSSR(config: ReactI18nCacheParams): void {
  setRenderStrategy('server-render');

  const i18nCache = new I18nCache<Translation>(config);
  setReactI18nCache(i18nCache);
}
