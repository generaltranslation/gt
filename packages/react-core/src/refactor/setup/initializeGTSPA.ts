import { I18nManager } from 'gt-i18n/internal';
import type { Translation } from 'gt-i18n/types';
import { setReactI18nManager } from '../i18n-manager/singleton-operations';
import type { ReactI18nManagerParams } from '../i18n-manager/ReactI18nManager';
import {
  ReactConditionStore,
  ReactConditionStoreParams,
} from '../condition-store/ReactConditionStore';
import { I18nStore, I18nStoreParams } from '../i18n-store/I18nStore';
import { setRenderStrategy, setStoresInitialized } from './globals';
import { setConditionStore } from '../condition-store/singleton-operations';
import { setI18nStore } from '../i18n-store/singleton-operations';

/**
 * Initialize GT for an SPA
 * - i18nManager
 * - conditionStore
 * - i18nStore
 *
 * @deprecated moved to /react and /react-native
 */
export function internalInitializeGTSPA(
  config: I18nStoreParams & ReactI18nManagerParams & ReactConditionStoreParams
): void {
  setRenderStrategy('SPA');

  const i18nManager = new I18nManager<Translation>(config);
  setReactI18nManager(i18nManager);

  const conditionStore = new ReactConditionStore(config);
  setConditionStore(conditionStore);

  const i18nStore = new I18nStore(config);
  setI18nStore(i18nStore);

  setStoresInitialized(true);
}
