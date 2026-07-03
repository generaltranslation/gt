import { createDiagnosticMessage } from 'generaltranslation/internal';
import { createConditionStoreSingleton } from './createConditionStoreSingleton';
import { WritableConditionStore } from './WritableConditionStore';

export const {
  getConditionStore: getWritableConditionStore,
  setConditionStore: setWritableConditionStore,
} = createConditionStoreSingleton<WritableConditionStore>(
  createDiagnosticMessage({
    source: 'gt-i18n',
    severity: 'Error',
    whatHappened: 'Cannot read the locale before GT has been initialized',
    why: 'the internal ConditionStore singleton is unavailable',
    fix: 'Initialize GT before calling translation functions (e.g. call initializeGT() from your GT framework package).',
  })
);
