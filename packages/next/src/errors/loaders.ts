import { createGtNextDiagnostic } from './diagnostics';

export const createUnresolvedCustomLoadDictionaryError = () =>
  createGtNextDiagnostic({
    severity: 'Error',
    whatHappened:
      'loadDictionary() was found during the build but could not be resolved at runtime',
    fix: 'Export a loadDictionary() function from the configured file',
  });

export const createUnresolvedCustomLoadTranslationsError = () =>
  createGtNextDiagnostic({
    severity: 'Error',
    whatHappened:
      'loadTranslations() was found during the build but could not be resolved at runtime',
    fix: 'Export a loadTranslations() function from the configured file',
  });
