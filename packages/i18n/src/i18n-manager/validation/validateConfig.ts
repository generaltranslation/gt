import { ValidationResult } from './types';
import { I18nManagerConstructorParams } from '../types';
import { validateLoadTranslations } from './config-validation/validateLoadTranslations';
import { validateTranslationApi } from './config-validation/validateTranslationApi';
import { validateLocales } from './config-validation/validateLocales';

/**
 * Validate the configuration
 * @param config - The configuration to validate
 * @returns The validation results
 */
export function validateConfig(
  config: I18nManagerConstructorParams
): ValidationResult[] {
  const results: ValidationResult[] = [];

  results.push(...validateLoadTranslations(config));
  results.push(...validateTranslationApi(config));
  results.push(...validateLocales(config));

  return results;
}
