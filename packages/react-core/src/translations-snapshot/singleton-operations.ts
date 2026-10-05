import { createDiagnosticMessage } from 'generaltranslation/internal';
import { createGlobalSingleton } from 'gt-i18n/internal';
import type { Hash, Locale } from 'gt-i18n/internal/types';
import type { Translation } from 'gt-i18n/types';

export type TranslationsSnapshot = Record<Locale, Record<Hash, Translation>>;

const translationsSnapshotSingleton =
  createGlobalSingleton<TranslationsSnapshot>({
    namespace: 'reactCore',
    key: 'translationsSnapshot',
    source: '@generaltranslation/react-core',
    notInitialized: () => createTranslationsSnapshotNotInitializedError(),
  });

function createTranslationsSnapshotNotInitializedError(): Error {
  const errorMessage = createDiagnosticMessage({
    source: '@generaltranslation/react-core',
    severity: 'Error',
    whatHappened:
      'Cannot access TranslationsSnapshot before it is initialized.',
    fix: 'Initialize GT before reading translations snapshot.',
  });

  return new Error(errorMessage);
}

export const getGlobalTranslationsSnapshot = translationsSnapshotSingleton.get;
export const setGlobalTranslationsSnapshot = translationsSnapshotSingleton.set;
export const isGlobalTranslationsSnapshotInitialized =
  translationsSnapshotSingleton.isInitialized;
