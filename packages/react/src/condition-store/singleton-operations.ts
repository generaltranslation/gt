import { createDiagnosticMessage } from 'generaltranslation/internal';
import {
  createConditionStoreSingleton,
  ReadonlyConditionStore,
} from 'gt-i18n/internal';
import { BrowserConditionStore } from './BrowserConditionStore';

// Both singletons below are typed views of the same global slot (namespace
// 'i18n', key 'conditionStore'), so there is a single uninitialized state and
// one message describes it for both getters.
const conditionStoreNotInitializedError = createDiagnosticMessage({
  source: 'gt-react',
  severity: 'Error',
  whatHappened: 'Cannot read GT runtime context before it has been initialized',
  why: 'the internal ConditionStore singleton is unavailable',
  fix: 'Call initializeGT() (or initializeGTSPA() in SPA apps) before rendering.',
});

export const {
  setConditionStore: setReadonlyConditionStore,
  isConditionStoreInitialized: isReadonlyConditionStoreInitialized,
} = createConditionStoreSingleton<ReadonlyConditionStore>(
  conditionStoreNotInitializedError
);

export const {
  getConditionStore: getBrowserConditionStore,
  setConditionStore: setBrowserConditionStore,
  isConditionStoreInitialized: isBrowserConditionStoreInitialized,
} = createConditionStoreSingleton<BrowserConditionStore>(
  conditionStoreNotInitializedError
);
