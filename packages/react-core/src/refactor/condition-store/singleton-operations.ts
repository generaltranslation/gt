import {
  createConditionStoreSingleton,
  WritableConditionStore,
} from 'gt-i18n/internal';

export const { getConditionStore, setConditionStore } =
  createConditionStoreSingleton<WritableConditionStore>(
    'ConditionStore is not initialized.'
  );
