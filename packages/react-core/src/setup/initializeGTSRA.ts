import type { ReactI18nCacheParams } from '../i18n-cache/ReactI18nCache';
import { initializeI18nConfig, type ReactI18nConfigParams } from './i18nConfig';

export type ReactInitializeGTParams = ReactI18nConfigParams &
  ReactI18nCacheParams;

/**
 * Validation and setup for read only properties
 *
 * Does not create the i18nCache: callers invoke initializeReactI18nCache()
 * when their runtime needs one.
 */
export function internalInitializeGTSRA(config: ReactInitializeGTParams): void {
  initializeI18nConfig(config, 'server-render');
}
