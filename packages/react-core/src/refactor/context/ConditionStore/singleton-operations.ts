import { createConditionStoreSingleton } from "gt-i18n/internal";
import { ReactConditionStore } from "./ReactConditionStore";

export const { getConditionStore, setConditionStore } =
  createConditionStoreSingleton<ReactConditionStore>(
    "ConditionStore is not initialized.",
  );
