import { createDiagnosticMessage } from 'generaltranslation/internal';
import { createGlobalSingleton } from 'gt-i18n/internal';
import type { Locale } from 'gt-i18n/internal/types';
import type { Dictionary } from 'gt-i18n/types';

export type DictionariesSnapshot = Record<Locale, Dictionary>;

const dictionariesSnapshotSingleton =
  createGlobalSingleton<DictionariesSnapshot>({
    namespace: 'reactCore',
    key: 'dictionariesSnapshot',
    source: '@generaltranslation/react-core',
    notInitialized: () => createDictionariesSnapshotNotInitializedError(),
  });

function createDictionariesSnapshotNotInitializedError(): Error {
  const errorMessage = createDiagnosticMessage({
    source: '@generaltranslation/react-core',
    severity: 'Error',
    whatHappened:
      'Cannot access DictionariesSnapshot before it is initialized.',
    fix: 'Initialize GT before reading dictionaries snapshot.',
  });

  return new Error(errorMessage);
}

export const getGlobalDictionariesSnapshot = dictionariesSnapshotSingleton.get;
export const setGlobalDictionariesSnapshot = dictionariesSnapshotSingleton.set;
export const isGlobalDictionariesSnapshotInitialized =
  dictionariesSnapshotSingleton.isInitialized;
