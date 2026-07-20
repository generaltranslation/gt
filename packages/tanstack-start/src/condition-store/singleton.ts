import { createDiagnosticMessage } from 'generaltranslation/internal';
import { createConditionStoreSingleton } from 'gt-i18n/internal';
import { AsyncLocalConditionStore } from './AsyncLocalConditionStore';

const conditionStoreNotInitializedError = createDiagnosticMessage({
  source: 'gt-tanstack-start',
  severity: 'Error',
  whatHappened: 'Cannot read GT server request state before initialization',
  why: 'the internal ConditionStore singleton is unavailable',
  fix: "Import GT server APIs from the 'gt-tanstack-start/server' entry point.",
});

const { getConditionStore, setConditionStore, isConditionStoreInitialized } =
  createConditionStoreSingleton<AsyncLocalConditionStore>(
    conditionStoreNotInitializedError
  );

function getOrInitializeConditionStore(): AsyncLocalConditionStore {
  if (!isConditionStoreInitialized()) {
    setConditionStore(new AsyncLocalConditionStore());
  }
  return getConditionStore();
}

export { getOrInitializeConditionStore as getConditionStore };
