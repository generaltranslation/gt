import { createConditionStoreSingleton } from "gt-i18n/internal";
import { I18nStore, I18nStoreParams } from "./I18nStore/I18nStore";
import {
  ReactConditionStore,
  ReactConditionStoreParams,
} from "./ConditionStore/ReactConditionStore";
import type { ReloadServerSideProps } from "./storeTypes";

// ===== I18n Store ===== //

let i18nStore: I18nStore | undefined;

export function getI18nStore(): I18nStore {
  if (!i18nStore) {
    throw new Error("I18nExternalStore is not initialized.");
  }
  return i18nStore;
}

export function setI18nStore(nextStore: I18nStore): void {
  i18nStore?.disconnect();
  i18nStore = nextStore;
}

// ===== Initialization ===== //

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
  i18nStoreConfig,
  conditionStoreConfig,
}: InitializeStoresParams): void {
  if (i18nStore) {
    throw new Error("I18nStore already initialized.");
  }
  i18nStore = new I18nStore(i18nStoreConfig);
}
