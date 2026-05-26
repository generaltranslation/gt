import { I18nManager, WritableConditionStore } from "gt-i18n/internal";
import type { WritableConditionStoreParams } from "gt-i18n/internal";
import type { Translation } from "gt-i18n/types";
import { setReactI18nManager } from "../i18n-manager/singleton-operations";
import type { ReactI18nManagerParams } from "../i18n-manager/ReactI18nManager";
import { I18nStore, I18nStoreParams } from "../i18n-store/I18nStore";
import { setRenderStrategy, setStoresInitialized } from "./globals";
import { setReadonlyConditionStore } from "../condition-store/singleton-operations";
import { setI18nStore } from "../i18n-store/singleton-operations";

/**
 * Initialize GT for an SPA
 * - i18nManager
 * - conditionStore
 * - i18nStore
 *
 * @deprecated moved to /react and /react-native
 */
export function internalInitializeGTSPA(
  config: I18nStoreParams &
    ReactI18nManagerParams &
    WritableConditionStoreParams,
): void {
  setRenderStrategy("SPA");

  const i18nManager = new I18nManager<Translation>(config);
  setReactI18nManager(i18nManager);

  const conditionStore = new WritableConditionStore(config);
  setReadonlyConditionStore(conditionStore);

  const i18nStore = new I18nStore(config);
  setI18nStore(i18nStore);

  setStoresInitialized(true);
}
