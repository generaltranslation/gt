import { setI18nManager } from 'gt-i18n/internal';
import type { ConfigGTParams } from './types';
import { AsyncStorageI18nManager } from '../i18n-manager/AsyncStorageI18nManager';
import { AsyncStorageAdapter } from '../i18n-manager/AsyncStorageAdapter';

/**
 * Configure GT for node runtime. This must be called to setup GT for node runtime.
 * @param {ConfigGTParams} config - The configuration for the GT instance
 * TODO: auto detect if can find gt.config.json files
 */
export function configGT(config: ConfigGTParams): void {
  const i18nManager = new AsyncStorageI18nManager({
    ...config,
    storeAdapter: new AsyncStorageAdapter(),
  });

  setI18nManager(i18nManager);
}
