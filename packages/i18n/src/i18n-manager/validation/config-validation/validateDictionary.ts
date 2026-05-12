import type { DictionaryLoader } from '../../translations-manager/LocalesDictionaryCache';
import type { Dictionary } from '../../translations-manager/DictionaryCache';
import type { ValidationResult } from '../types';
import { createDiagnosticMessage } from 'generaltranslation/internal';

/**
 * Dictionary configuration
 *
 * Requirements:
 * - loadDictionary requires dictionary so the default locale always has a source dictionary
 */
export function validateDictionary(params: {
  dictionary?: Dictionary;
  loadDictionary?: DictionaryLoader;
}): ValidationResult[] {
  const results: ValidationResult[] = [];

  if (params.loadDictionary && !params.dictionary) {
    results.push({
      type: 'error',
      message: createDiagnosticMessage({
        whatHappened: 'loadDictionary needs a source dictionary',
        fix: 'Provide dictionary so the default locale has source content',
      }),
    });
  }

  return results;
}
