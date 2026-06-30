import type { I18nConfigParams } from 'gt-i18n/internal/types';
import type { ReactI18nCacheParams } from '../i18n-cache/ReactI18nCache';
import { setReactI18nCache } from '../i18n-cache/singleton-operations';
import { ReactI18nCache } from '../i18n-cache/ReactI18nCache';
import { initializeI18nConfig } from './i18nConfig';

/**
 * Validation and setup for read only properties
 */
export function internalInitializeGTSRA(
  config: I18nConfigParams & ReactI18nCacheParams
): void {
  initializeI18nConfig(config, 'server-render');

  const i18nCache = new ReactI18nCache(config);
  setReactI18nCache(i18nCache);
}
