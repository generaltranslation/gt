import { ReactI18nManagerConstructorParams } from "../../state/ReactI18nManager";
import {
  ReactConditionStore,
  ReactConditionStoreParams,
} from "../ConditionStore/ReactConditionStore";
import { setConditionStore } from "../ConditionStore/singleton-operations";
import { I18nStore, I18nStoreParams } from "../I18nStore/I18nStore";
import { setI18nStore } from "../I18nStore/singleton-operations";

export type InitializeStoresParams = {
  i18nStoreConfig: I18nStoreParams;
  conditionStoreConfig: ReactConditionStoreParams;
};

/**
 * This init function MUST go in the provider
 * - for the condition store, this is b/c it stores info related to the current locale
 * - for i18nStore, not a heavy requirement, but this would be necessary for reloadServerSideProps()
 */
export function initializeStores({
  conditionStoreConfig,
  i18nStoreConfig,
}: InitializeStoresParams): void {
  const conditionStore = new ReactConditionStore({ conditionStoreConfig });
  setConditionStore(conditionStore);

  const i18nStore = new I18nStore(i18nStoreConfig);
  setI18nStore(i18nStore);
}
