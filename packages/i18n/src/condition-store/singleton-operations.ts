import { createConditionStoreSingleton } from './createConditionStoreSingleton';
import { WritableConditionStore } from './WritableConditionStore';

export const {
  getConditionStore: getWritableConditionStore,
  setConditionStore: setWritableConditionStore,
} = createConditionStoreSingleton<WritableConditionStore>(
  'WritableConditionStore is not initialized.'
);
