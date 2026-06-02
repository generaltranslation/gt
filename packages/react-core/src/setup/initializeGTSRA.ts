import { initializeI18nConfig, setupGTServicesEnabled } from 'gt-i18n/internal';
import type {
  GTServicesEnabledParams,
  I18nConfigParams,
} from 'gt-i18n/internal/types';
import { setRenderStrategy } from './globals';
import type { ReactI18nCacheParams } from '../i18n-cache/ReactI18nCache';
import { setReactI18nCache } from '../i18n-cache/singleton-operations';
import { ReactI18nCache } from '../i18n-cache/ReactI18nCache';

/**
 * Validation and setup for read only properties
 */
export function internalInitializeGTSRA(
  config: I18nConfigParams & GTServicesEnabledParams & ReactI18nCacheParams
): void {
  setRenderStrategy('server-render');
  setupGTServicesEnabled(config);
  initializeI18nConfig(config);

  const i18nCache = new ReactI18nCache(config);
  setReactI18nCache(i18nCache);
}
