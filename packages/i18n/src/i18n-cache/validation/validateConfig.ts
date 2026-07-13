import { ValidationResult } from './types';
import { I18nCacheConstructorParams } from '../types';
import { validateLoadTranslations } from './config-validation/validateLoadTranslations';
import { validateTranslationApi } from './config-validation/validateTranslationApi';
import { validateDictionary } from './config-validation/validateDictionary';

/**
 * Validate the configuration
 * @param config - The configuration to validate
 * @returns The validation results
 */
export function validateConfig(
  config: I18nCacheConstructorParams
): ValidationResult[] {
  const results: ValidationResult[] = [];

  results.push(...validateLoadTranslations(config));
  results.push(...validateTranslationApi(config));
  results.push(...validateDictionary(config));

  return results;
}
