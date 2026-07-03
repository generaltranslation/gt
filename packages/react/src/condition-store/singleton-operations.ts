import { createDiagnosticMessage } from 'generaltranslation/internal';
import {
  createConditionStoreSingleton,
  ReadonlyConditionStore,
} from 'gt-i18n/internal';
import { BrowserConditionStore } from './BrowserConditionStore';

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
