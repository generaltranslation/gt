import {
  createConditionStoreSingleton,
  WritableConditionStore,
} from "gt-i18n/internal";

export const {
  getConditionStore: getWritableConditionStore,
  setConditionStore: setWritableConditionStore,
} = createConditionStoreSingleton<WritableConditionStore>(
  "WritableConditionStore is not initialized.",
);
