import {
  I18nManager,
  setI18nManager,
  setConditionStore,
} from 'gt-i18n/internal';
import type { Translation } from 'gt-i18n/types';
import type { InitializeGTParams } from './types';
import { TanstackConditionStore } from '../runtime/TanstackConditionStore';

/**
 * Configure GT for TanStack Start. This must be called to setup GT for TanStack Start.
 * @param {InitializeGTParams} config - The configuration for the GT instance
 * TODO: auto detect if can find gt.config.json files
 */
export function initializeGT(params: InitializeGTParams): void {
  const i18nManager = new I18nManager<Translation>(params);
  const conditionStore = new TanstackConditionStore({
    defaultLocale: i18nManager.getDefaultLocale(),
    locales: i18nManager.getLocales(),
    customMapping: i18nManager.getCustomMapping(),
  });

  setI18nManager(i18nManager);
  setConditionStore(conditionStore);
}
