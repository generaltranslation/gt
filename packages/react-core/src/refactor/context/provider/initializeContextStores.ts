import {
  ReactConditionStore,
  ReactConditionStoreParams,
} from "../../condition-store/ReactConditionStore";
import { setConditionStore } from "../../condition-store/singleton-operations";
import { I18nStore, I18nStoreParams } from "../I18nStore/I18nStore";
import { setI18nStore } from "../I18nStore/singleton-operations";
import { setStoresInitialized, storesInitialized } from "../../setup/globals";

/**
 * This init function MUST go in the provider
 * - for the condition store, this is b/c it stores info related to the current locale
 * - for i18nStore, not a heavy requirement, but this would be necessary for reloadServerSideProps()
 */
export function initializeContextStores({
  locale,
  defaultLocale,
  locales,
  customMapping,
  i18nEnabled,
  overrideSetLocale: reloadServerSideProps,
}: I18nStoreParams & ReactConditionStoreParams): void {
  const conditionStore = new ReactConditionStore({
    locale,
    defaultLocale,
    locales,
    customMapping,
    i18nEnabled,
  });
  setConditionStore(conditionStore);

  const i18nStore = new I18nStore({
    overrideSetLocale: reloadServerSideProps,
  });
  setI18nStore(i18nStore);

  setStoresInitialized(true);
}
