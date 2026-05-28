import { setAsyncConditionStore } from '../async-i18n-cache/singleton-operations';
import type { InitializeGTParams } from './types';
import {
  I18nCache,
  initializeI18nConfig,
  setupGTServicesEnabled,
  setI18nCache,
} from 'gt-i18n/internal';
import { AsyncConditionStore } from '../async-i18n-cache/AsyncConditionStore';

/**
 * Configure GT for node runtime. This must be called to setup GT for node runtime.
 * @param {InitializeGTParams} config - The configuration for the GT instance
 * TODO: auto detect if can find gt.config.json files
 */
export function initializeGT(params: InitializeGTParams): void {
  setupGTServicesEnabled(params);
  initializeI18nConfig(params);

  const i18nCache = new I18nCache<string>(params);
  const conditionStore = new AsyncConditionStore();

  setI18nCache(i18nCache);
  setAsyncConditionStore(conditionStore);
}
