import { createDiagnosticMessage } from 'generaltranslation/internal';
import { createConditionStoreSingleton } from 'gt-i18n/internal';
import type { AsyncConditionStore } from './AsyncConditionStore';

export const {
  getConditionStore: getAsyncConditionStore,
  setConditionStore: setAsyncConditionStore,
} = createConditionStoreSingleton<AsyncConditionStore>(
  createDiagnosticMessage({
    source: 'gt-node',
    severity: 'Error',
    whatHappened:
      'Cannot read request locale state before GT has been initialized',
    why: 'the internal ConditionStore singleton is unavailable',
    fix: 'Call initializeGT() before using translation functions.',
  })
);
