import type { ReadonlyConditionStore } from "../i18n-manager/types";

let conditionStore: ReadonlyConditionStore | undefined;

export function createConditionStoreSingleton<T extends ReadonlyConditionStore>(
  notInitializedMessage: string,
) {
  function getConditionStore(): T {
    /**
     * TODO: each package throws a different error message
     */
    if (!conditionStore) {
      throw new Error(notInitializedMessage);
    }
    return conditionStore as T;
  }

  function setConditionStore(nextConditionStore: T): void {
    conditionStore = nextConditionStore;
  }

  function isConditionStoreInitialized(): boolean {
    return conditionStore !== undefined;
  }

  return {
    getConditionStore,
    setConditionStore,
    isConditionStoreInitialized,
  };
}
