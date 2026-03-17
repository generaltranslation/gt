import { setI18nManager } from 'gt-i18n/internal';
import type { InitializeGTParams } from './types';
import { BrowserStorageAdapter } from '../browser-i18n-manager/BrowserStorageAdapter';
import { BrowserI18nManager } from '../browser-i18n-manager/BrowserI18nManager';

/**
 * Configure GT for browser runtime. This must be called to setup GT for browser runtime.
 * @param {InitializeGTParams} config - The configuration for the GT instance
 */
export function initializeGT(params: InitializeGTParams): void {
  const i18nManager = new BrowserI18nManager({
    ...params,
    storeAdapter: new BrowserStorageAdapter({ getLocale: params.getLocale }),
  });
  setI18nManager(i18nManager);
}
