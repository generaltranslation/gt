import { setAsyncConditionStore } from '../async-i18n-manager/singleton-operations';
import type { InitializeGTParams } from './types';
import { I18nManager, setI18nManager } from 'gt-i18n/internal';
import { AsyncConditionStore } from '../async-i18n-manager/AsyncConditionStore';

/**
 * Configure GT for node runtime. This must be called to setup GT for node runtime.
 * @param {InitializeGTParams} config - The configuration for the GT instance
 * TODO: auto detect if can find gt.config.json files
 */
export function initializeGT(params: InitializeGTParams): void {
  const i18nManager = new I18nManager<string>(params);
  const conditionStore = new AsyncConditionStore({
    defaultLocale: i18nManager.getDefaultLocale(),
    locales: i18nManager.getLocales(),
    customMapping: i18nManager.getCustomMapping(),
  });

  setI18nManager(i18nManager);
  setAsyncConditionStore(conditionStore);
}
