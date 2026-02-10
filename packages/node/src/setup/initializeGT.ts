import { setI18nManager } from '../async-i18n-manager/singleton-operations';
import type { InitializeGTParams } from './types';
import { AsyncStorageI18nManager } from '../async-i18n-manager/AsyncStorageI18nManager';
import { AsyncStorageAdapter } from '../async-i18n-manager/AsyncStorageAdapter';

/**
 * Configure GT for node runtime. This must be called to setup GT for node runtime.
 * @param {InitializeGTParams} config - The configuration for the GT instance
 * TODO: auto detect if can find gt.config.json files
 */
export function initializeGT(params: InitializeGTParams): void {
  const i18nManager = new AsyncStorageI18nManager({
    ...params,
    storeAdapter: new AsyncStorageAdapter(),
  });

  setI18nManager(i18nManager);
}
