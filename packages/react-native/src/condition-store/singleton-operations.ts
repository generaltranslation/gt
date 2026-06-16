import { createConditionStoreSingleton } from 'gt-i18n/internal';
import { NativeConditionStore } from './NativeConditionStore';

export const {
  getConditionStore: getNativeConditionStore,
  setConditionStore: setNativeConditionStore,
  isConditionStoreInitialized: isNativeConditionStoreInitialized,
} = createConditionStoreSingleton<NativeConditionStore>(
  'NativeConditionStore is not initialized.'
);
