import { createConditionStoreSingleton } from 'gt-i18n/internal';
import type { AsyncConditionStore } from './AsyncConditionStore';

export const {
  getConditionStore: getAsyncConditionStore,
  setConditionStore: setAsyncConditionStore,
  isConditionStoreInitialized: isAsyncConditionStoreInitialized,
} = createConditionStoreSingleton<AsyncConditionStore>(
  'AsyncConditionStore not initialized. The gt-astro middleware must run before translation functions.'
);
