import { createConditionStoreSingleton } from "gt-i18n/internal";
import type { ReadonlyConditionStoreInterface } from "gt-i18n/internal/types";

export const {
  getConditionStore: getReadonlyConditionStore,
  setConditionStore: setReadonlyConditionStore,
  isConditionStoreInitialized: isWritableConditionStoreInitialized,
} = createConditionStoreSingleton<ReadonlyConditionStoreInterface>(
  "ReadonlyConditionStore is not initialized.",
);
