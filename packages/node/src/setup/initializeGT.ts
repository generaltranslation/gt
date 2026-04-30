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
  const conditionStore = new AsyncConditionStore({
    defaultLocale: params.defaultLocale,
    locales: params.locales,
    customMapping: params.customMapping,
  });
  const i18nManager = new I18nManager<string>(params);

  setI18nManager(i18nManager);
  setAsyncConditionStore(conditionStore);
}
