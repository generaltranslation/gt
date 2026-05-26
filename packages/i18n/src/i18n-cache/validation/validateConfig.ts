import { ValidationResult } from './types';
import { I18nManagerConstructorParams } from '../types';
import { validateLoadTranslations } from './config-validation/validateLoadTranslations';
import { validateTranslationApi } from './config-validation/validateTranslationApi';
import { validateLocales } from './config-validation/validateLocales';
import { validateDictionary } from './config-validation/validateDictionary';
import type { Translation } from '../translations-manager/utils/types/translation-data';

/**
 * Validate the configuration
 * @param config - The configuration to validate
 * @returns The validation results
 */
export function validateConfig<TranslationValue extends Translation>(
  config: I18nManagerConstructorParams<TranslationValue>
): ValidationResult[] {
  const results: ValidationResult[] = [];

  results.push(...validateLoadTranslations(config));
  results.push(...validateTranslationApi(config));
  results.push(...validateLocales(config));
  results.push(...validateDictionary(config));

  return results;
}
