import { ReactI18nCache, type ReactI18nCacheParams } from './ReactI18nCache';
import { setReactI18nCache } from './singleton-operations';

/**
 * Create a ReactI18nCache and register it as the global i18nCache.
 * Callers decide whether their runtime needs one: servers always do, while
 * production clients that read server-provided snapshots do not.
 */
export function initializeReactI18nCache(params: ReactI18nCacheParams): void {
  setReactI18nCache(new ReactI18nCache(params));
}
