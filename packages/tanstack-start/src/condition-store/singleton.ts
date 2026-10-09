import { createDiagnosticMessage } from 'generaltranslation/internal';
import { createGlobalSingleton } from 'gt-i18n/internal';
import type { AsyncLocalConditionStore } from './AsyncLocalConditionStore';

const conditionStoreNotInitializedError = createDiagnosticMessage({
  source: 'gt-tanstack-start',
  severity: 'Error',
  whatHappened: 'Cannot read GT server request state before initialization',
  why: 'the gtTanstackStart() Vite plugin is not registered, so GT has no config',
  fix: "Add gtTanstackStart() from 'gt-tanstack-start/plugin/vite' to the plugins in your Vite config",
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
