import type { ReadonlyConditionStore } from '../types';
import { setConditionStore as setCurrentConditionStore } from '../singleton-operations';

export function createConditionStoreSingleton<T extends ReadonlyConditionStore>(
  notInitializedMessage: string
) {
  let conditionStore: T | undefined;

  function getConditionStore(): T {
    if (!conditionStore) {
      throw new Error(notInitializedMessage);
    }
    return conditionStore;
  }

  function setConditionStore(nextConditionStore: T): void {
    conditionStore = nextConditionStore;
    setCurrentConditionStore(nextConditionStore);
  }

  return {
    getConditionStore,
    setConditionStore,
  };
}
