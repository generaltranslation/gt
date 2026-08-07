import type { ReactI18nCacheParams } from '../i18n-cache/ReactI18nCache';
import { setReactI18nCache } from '../i18n-cache/singleton-operations';
import { ReactI18nCache } from '../i18n-cache/ReactI18nCache';
import { initializeI18nConfig, type ReactI18nConfigParams } from './i18nConfig';

export type ReactInitializeGTParams = ReactI18nConfigParams &
  ReactI18nCacheParams;

export type ReactInitializeGTClientParams = ReactInitializeGTParams;

/**
 * Validation and setup for read only properties
 */
export function internalInitializeGTSRA(config: ReactInitializeGTParams): void {
  initializeI18nConfig(config, 'server-render');

  const i18nCache = new ReactI18nCache(config);
  setReactI18nCache(i18nCache);
}
