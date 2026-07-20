import { createDiagnosticMessage } from 'generaltranslation/internal';
import { createGlobalSingleton } from 'gt-i18n/internal';
import type { AsyncLocalConditionStore } from './AsyncLocalConditionStore';

const conditionStoreNotInitializedError = createDiagnosticMessage({
  source: 'gt-tanstack-start',
  severity: 'Error',
  whatHappened: 'Cannot read GT server request state outside GT middleware',
  why: 'gtMiddleware has not initialized request-scoped conditions',
  fix: "Register gtMiddleware from 'gt-tanstack-start/server' as global TanStack Start request middleware.",
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
