import { setI18nManager } from 'gt-i18n/internal';
import type { InitializeGTParams } from './types';
import { I18nManager } from 'gt-i18n/internal';
/**
 * Configure GT for node runtime. This must be called to setup GT for node runtime.
 * @param {InitializeGTParams} config - The configuration for the GT instance
 * TODO: auto detect if can find gt.config.json files
 */
export function initializeGT(params: InitializeGTParams): void {
  const i18nManager = new I18nManager(params);
  setI18nManager(i18nManager);
}
