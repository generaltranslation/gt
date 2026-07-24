import { setAsyncConditionStore } from '../async-i18n-cache/singleton-operations';
import type { InitializeGTParams } from './types';
import { initializeI18nConfig, setI18nCache } from 'gt-i18n/internal';
import { I18nCache } from 'gt-i18n/internal/i18n-cache';
import { AsyncConditionStore } from '../async-i18n-cache/AsyncConditionStore';
import { addRuntimeCredentials } from './runtimeCredentials';

/**
 * Configure GT for node runtime. This must be called to setup GT for node runtime.
 * @param {InitializeGTParams} config - The configuration for the GT instance
 * TODO: auto detect if can find gt.config.json files
 */
export function initializeGT(params: InitializeGTParams): void {
  const config = addRuntimeCredentials(params);

  initializeI18nConfig(config);

  const i18nCache = new I18nCache<string>(config);
  const conditionStore = new AsyncConditionStore();

  setI18nCache(i18nCache);
  setAsyncConditionStore(conditionStore);
}
