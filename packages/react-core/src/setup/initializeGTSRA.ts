import type { ReactI18nCacheParams } from '../i18n-cache/ReactI18nCache';
import { setReactI18nCache } from '../i18n-cache/singleton-operations';
import { ReactI18nCache } from '../i18n-cache/ReactI18nCache';
import { initializeI18nConfig, type ReactI18nConfigParams } from './i18nConfig';
import { createGTMissingTranslationResolver } from 'gt-i18n/internal';
import { createResolveMissing } from '../i18n-cache/createResolveMissing';

export type ReactInitializeGTParams = ReactI18nConfigParams &
  ReactI18nCacheParams;

/**
 * Validation and setup for read only properties
 */
export function internalInitializeGTSRA(config: ReactInitializeGTParams): void {
  initializeI18nConfig(config, 'server-render');
  initializeCache(config, {
    createMissingTranslationResolver:
      createGTMissingTranslationResolver(config),
    createResolveMissing,
  });
}

export function internalInitializeStaticGTSRA(
  config: ReactInitializeGTParams
): void {
  initializeI18nConfig(config, 'server-render');
  initializeCache(config);
}

function initializeCache(
  config: ReactInitializeGTParams,
  dependencies?: ConstructorParameters<typeof ReactI18nCache>[1]
): void {
  const i18nCache = new ReactI18nCache(config, dependencies);
  setReactI18nCache(i18nCache);
}
