import {
  I18nCache,
  initializeI18nConfig,
  setupGTServicesEnabled,
} from 'gt-i18n/internal';
import type {
  GTServicesEnabledParams,
  I18nConfigParams,
} from 'gt-i18n/internal/types';
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
export function internalInitializeGTSSR(
  config: I18nConfigParams & GTServicesEnabledParams & ReactI18nCacheParams
): void {
  setRenderStrategy('server-render');

  setupGTServicesEnabled(config);
  initializeI18nConfig(config);

  const i18nCache = new I18nCache<Translation>(config);
  setReactI18nCache(i18nCache);
}
