import { setI18nManager } from "../i18n-manager/singleton-operations";
import {
  ReactI18nManager,
  ReactI18nManagerConstructorParams,
} from "../i18n-manager/ReactI18nManager";
import {
  ReactConditionStore,
  ReactConditionStoreParams,
} from "../condition-store/ReactConditionStore";
import { I18nStore, I18nStoreParams } from "../context/I18nStore/I18nStore";
import { setRenderStrategy, setStoresInitialized } from "./globals";
import { setConditionStore } from "../condition-store/singleton-operations";
import { setI18nStore } from "../context/I18nStore/singleton-operations";

/**
 * Initialize GT for an SPA
 * - i18nManager
 * - conditionStore
 * - i18nStore
 */
export function initializeGTSPA(
  config: ReactConditionStoreParams &
    I18nStoreParams &
    ReactI18nManagerConstructorParams,
): void {
  setRenderStrategy("SPA");

  const i18nManager = new ReactI18nManager(config);
  setI18nManager(i18nManager);

  const conditionStore = new ReactConditionStore(config);
  setConditionStore(conditionStore);

  const i18nStore = new I18nStore(config);
  setI18nStore(i18nStore);

  setStoresInitialized(true);
}
