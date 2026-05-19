import {
  getTranslationsSnapshot,
  I18nStoreParams,
  setRenderStrategy,
  I18nStore,
  setI18nStore,
  setStoresInitialized,
  setConditionStore,
  setReactI18nManager,
} from '@generaltranslation/react-core/context';
import { BrowserI18nManager } from '../i18n-manager/BrowserI18nManager';
import type { BrowserI18nManagerParams } from '../i18n-manager/BrowserI18nManager';
import {
  createBrowserConditionStore,
  CreateBrowserConditionStoreParams,
} from '../condition-store/createBrowserConditionStore';

/**
 * Initialize GT for an SPA
 * - i18nManager
 * - conditionStore
 * - i18nStore
 *
 * This is SPA for browser runtime
 */
export async function initializeGTSPA(
  config: I18nStoreParams &
    BrowserI18nManagerParams &
    CreateBrowserConditionStoreParams
) {
  setRenderStrategy('SPA');

  const i18nManager = new BrowserI18nManager(config);
  setReactI18nManager(i18nManager);

  const conditionStore = createBrowserConditionStore(config);
  setConditionStore(conditionStore);

  const i18nStore = new I18nStore(config);
  setI18nStore(i18nStore);

  setStoresInitialized(true);

  // Block until translations are loaded
  await getTranslationsSnapshot(conditionStore.getLocale());
}
