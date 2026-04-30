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
  const i18nManager = new BrowserI18nManager(params);
  const conditionStore = new BrowserConditionStore({
    defaultLocale: i18nManager.getDefaultLocale(),
    locales: i18nManager.getLocales(),
    customMapping: i18nManager.getCustomMapping(),
    getLocale: params.getLocale,
  });

  setI18nManager(i18nManager);
  setBrowserConditionStore(conditionStore);
}
