import {
  I18nCache,
  setupGTServicesEnabled,
  WritableConditionStore,
} from 'gt-i18n/internal';
import type {
  GTServicesEnabledParams,
  I18nConfigParams,
  WritableConditionStoreParams,
} from 'gt-i18n/internal/types';
import type { Translation } from 'gt-i18n/types';
import { setReactI18nCache } from '../i18n-cache/singleton-operations';
import type { ReactI18nCacheParams } from '../i18n-cache/ReactI18nCache';
import { I18nStore } from '../i18n-store/I18nStore';
import { setReadonlyConditionStore } from '../condition-store/singleton-operations';
import { setI18nStore } from '../i18n-store/singleton-operations';
import { initializeI18nConfig } from './i18nConfig';

/**
 * Initialize GT for an SPA
 * - i18nCache
 * - conditionStore
 * - i18nStore
 *
 * @deprecated moved to /react and /react-native
 */
export function internalInitializeGTSPA(
  config: I18nConfigParams &
    GTServicesEnabledParams &
    ReactI18nCacheParams &
    WritableConditionStoreParams
): void {
  setupGTServicesEnabled(config);
  initializeI18nConfig(config, 'SPA');

  const i18nCache = new I18nCache<Translation>(config);
  setReactI18nCache(i18nCache);

  const conditionStore = new WritableConditionStore(config);
  setReadonlyConditionStore(conditionStore);

  const i18nStore = new I18nStore();
  setI18nStore(i18nStore);
}
