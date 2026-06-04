import {
  I18nCache,
  initializeI18nConfig,
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
import { setRenderStrategy } from './globals';
import { setReadonlyConditionStore } from '../condition-store/singleton-operations';
import { setI18nStore } from '../i18n-store/singleton-operations';

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
  setRenderStrategy('SPA');

  setupGTServicesEnabled(config);
  initializeI18nConfig(config);

  const i18nCache = new I18nCache<Translation>(config);
  setReactI18nCache(i18nCache);

  const conditionStore = new WritableConditionStore(config);
  setReadonlyConditionStore(conditionStore);

  const i18nStore = new I18nStore();
  setI18nStore(i18nStore);
}
