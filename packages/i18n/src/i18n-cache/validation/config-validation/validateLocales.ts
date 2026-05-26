import { isValidLocale } from '@generaltranslation/format';
import { createDiagnosticMessage } from 'generaltranslation/internal';
import { ValidationResult } from '../types';
import type { I18nConfigParams } from '../../../i18n-config/I18nConfig';

/**
 * Validate the locales configuration
 * @param params - The parameters to validate
 * @returns The validation results
 *
 * Only apply if using GT services
 */
export function validateLocales(
  params: I18nConfigParams,
  shouldValidate = true
): ValidationResult[] {
  const results: ValidationResult[] = [];
  if (!shouldValidate) {
    return results;
  }
  const { defaultLocale, locales, customMapping } = params;

  const localesToValidate = new Set([
    ...(defaultLocale ? [defaultLocale] : []),
    ...(locales || []),
  ]);

  localesToValidate.forEach((locale) => {
    if (!isValidLocale(locale, customMapping)) {
      results.push({
        type: 'error',
        message: createDiagnosticMessage({
          whatHappened: `Locale "${locale}" is not valid`,
          fix: 'Use a valid BCP 47 locale code or add a custom mapping',
        }),
      });
    }
  });

  return results;
}
