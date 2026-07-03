import { createConditionStoreSingleton } from "gt-i18n/internal";
import type { WritableConditionStoreInterface } from "gt-i18n/internal/types";

export const {
  getConditionStore: getWritableConditionStore,
  setConditionStore: setWritableConditionStore,
} = createConditionStoreSingleton<WritableConditionStoreInterface>(
  "WritableConditionStore is not initialized.",
);
