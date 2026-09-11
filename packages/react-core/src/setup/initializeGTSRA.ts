import type { ReactI18nCacheParams } from '../i18n-cache/ReactI18nCache';
import { setReactI18nCache } from '../i18n-cache/singleton-operations';
import { ReactI18nCache } from '../i18n-cache/ReactI18nCache';
import { initializeI18nConfig, type ReactI18nConfigParams } from './i18nConfig';
import { createClientI18nRuntime, setI18nRuntime } from 'gt-i18n/internal';

export type ReactInitializeGTParams = ReactI18nConfigParams &
  ReactI18nCacheParams;

/**
 * Validation and setup for read only properties
 */
export function internalInitializeGTSRA(config: ReactInitializeGTParams): void {
  initializeI18nConfig(config, 'server-render');

  initializeCache(config);
}

export function internalInitializeGTSRAClient(
  config: ReactInitializeGTParams
): void {
  initializeI18nConfig(config, 'server-render');

  if (process.env.NODE_ENV === 'production') {
    setI18nRuntime(createClientI18nRuntime(config));
  } else {
    initializeCache(config);
  }
}

function initializeCache(config: ReactInitializeGTParams): void {
  setReactI18nCache(new ReactI18nCache(config));
}
