import { createDiagnosticMessage } from 'generaltranslation/internal';
import { createGlobalSingleton } from 'gt-i18n/internal';
import type { AsyncLocalConditionStore } from './AsyncLocalConditionStore';

const conditionStoreNotInitializedError = createDiagnosticMessage({
  source: 'gt-tanstack-start',
  severity: 'Error',
  whatHappened: 'Cannot read GT server request state before initialization',
  why: 'initializeGT() has not initialized the TanStack Start server condition store',
  fix: "Call initializeGT() from 'gt-tanstack-start' during application setup before using gtMiddleware or server APIs.",
});

const conditionStoreSingleton = createGlobalSingleton<AsyncLocalConditionStore>(
  {
    namespace: 'tanstackStart',
    key: 'conditionStore',
    source: 'gt-tanstack-start',
    notInitialized: () => conditionStoreNotInitializedError,
  }
);

export const getConditionStore = conditionStoreSingleton.get;
export const setConditionStore = conditionStoreSingleton.set;
export const isConditionStoreInitialized =
  conditionStoreSingleton.isInitialized;
