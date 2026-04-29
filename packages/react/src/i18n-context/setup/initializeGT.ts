import { setI18nManager } from 'gt-i18n/internal';
import type { InitializeGTParams } from './types';
import { BrowserConditionStore } from '../browser-i18n-manager/BrowserConditionStore';
import { BrowserI18nManager } from '../browser-i18n-manager/BrowserI18nManager';
import { setBrowserConditionStore } from '../browser-i18n-manager/singleton-operations';

/**
 * Configure GT for browser runtime. This must be called to setup GT for browser runtime.
 * @param {InitializeGTParams} config - The configuration for the GT instance
 */
export function initializeGT(params: InitializeGTParams): void {
  const conditionStore = new BrowserConditionStore({
    defaultLocale: params.defaultLocale,
    locales: params.locales,
    customMapping: params.customMapping,
    getLocale: params.getLocale,
  });
  const i18nManager = new BrowserI18nManager(params);

  setBrowserConditionStore(conditionStore);
  setI18nManager(i18nManager);
}
