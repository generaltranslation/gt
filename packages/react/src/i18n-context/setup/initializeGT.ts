import { setI18nManager } from 'gt-i18n/internal';
import type { InitializeGTParams } from './types';
import { BrowserStorageAdapter } from '../browser-i18n-manager/BrowserStorageAdapter';
import { BrowserI18nManager } from '../browser-i18n-manager/BrowserI18nManager';
import { libraryDefaultLocale } from 'generaltranslation/internal';

/**
 * Configure GT for node runtime. This must be called to setup GT for node runtime.
 * @param {InitializeGTParams} config - The configuration for the GT instance
 */
export function initializeGT(params: InitializeGTParams): void {
  const i18nManager = new BrowserI18nManager({
    ...params,
    storeAdapter: new BrowserStorageAdapter({
      ...params,
      defaultLocale: params.defaultLocale || libraryDefaultLocale,
      locales: params.locales || [libraryDefaultLocale],
    }),
  });
  setI18nManager(i18nManager);
}
