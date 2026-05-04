import type { DictionaryLoader } from '../../translations-manager/LocalesDictionaryCache';
import type { Dictionary } from '../../translations-manager/DictionaryCache';
import type { ValidationResult } from '../types';

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
      message: 'dictionary is required when loadDictionary is provided',
    });
  }

  return results;
}
