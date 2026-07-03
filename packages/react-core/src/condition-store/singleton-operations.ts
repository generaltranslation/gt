import { createDiagnosticMessage } from 'generaltranslation/internal';
import { createConditionStoreSingleton } from 'gt-i18n/internal';
import type { ReadonlyConditionStoreInterface } from 'gt-i18n/internal/types';

const conditionStoreNotInitializedError = createDiagnosticMessage({
  source: '@generaltranslation/react-core',
  severity: 'Error',
  whatHappened: 'Cannot read GT runtime context before it has been initialized',
  why: 'The internal ConditionStore is unavailable',
  fix: 'Call initializeGT() during setup (gt-next runs this automatically) and add a <GTProvider> at the root of your component tree.',
});

const { getConditionStore, setConditionStore, isConditionStoreInitialized } =
  createConditionStoreSingleton<ReadonlyConditionStoreInterface>(
    conditionStoreNotInitializedError
  );

export {
  getConditionStore as getReadonlyConditionStore,
  setConditionStore as setReadonlyConditionStore,
  isConditionStoreInitialized as isReadonlyConditionStoreInitialized,
};
