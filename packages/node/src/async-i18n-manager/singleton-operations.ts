import { createConditionStoreSingleton } from 'gt-i18n/internal';
import type { AsyncConditionStore } from './AsyncConditionStore';

export const {
  getConditionStore: getAsyncConditionStore,
  setConditionStore: setAsyncConditionStore,
} = createConditionStoreSingleton<AsyncConditionStore>(
  'AsyncConditionStore not initialized. Invoke initializeGT() to initialize.'
);
