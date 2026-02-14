import { setI18nManager } from 'gt-i18n/internal';
import type { InitializeGTParams } from './types';
import { TanstackStorageAdapter } from '../tanstack-i18n-manager/TanstackStorageAdapter';
import { TanstackI18nManager } from '../tanstack-i18n-manager/TanstackI18nManager';

/**
 * Configure GT for node runtime. This must be called to setup GT for node runtime.
 * @param {InitializeGTParams} config - The configuration for the GT instance
 * TODO: auto detect if can find gt.config.json files
 */
export function initializeGT(params: InitializeGTParams): void {
  const i18nManager = new TanstackI18nManager({
    ...params,
    storeAdapter: new TanstackStorageAdapter(),
  });
  setI18nManager(i18nManager);
}
