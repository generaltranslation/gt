import {
  createConditionStoreSingleton,
  ReadonlyConditionStore,
} from 'gt-i18n/internal';
import { BrowserConditionStore } from './BrowserConditionStore';

export const {
  setConditionStore: setReadonlyConditionStore,
  isConditionStoreInitialized: isReadonlyConditionStoreInitialized,
} = createConditionStoreSingleton<ReadonlyConditionStore>(
  'ReadonlyConditionStore is not initialized.'
);

export const {
  getConditionStore: getBrowserConditionStore,
  setConditionStore: setBrowserConditionStore,
  isConditionStoreInitialized: isBrowserConditionStoreInitialized,
} = createConditionStoreSingleton<BrowserConditionStore>(
  'BrowserConditionStore is not initialized.'
);
