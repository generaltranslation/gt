import { ValidationResult } from '../types';

/**
 * Validate the locales configuration
 * @param params - The parameters to validate
 * @returns The validation results
 *
 * Locale validation rules:
 * - defaultLocale is required when locales are provided
 * - defaultLocale must be included in the locales array
 * - locales should not contain duplicates
 * - locales should be valid locale codes (e.g., 'en', 'en-US', 'fr-FR')
 *
 * Requirements:
 * - If locales is provided:
 *   - defaultLocale is required
 *   - defaultLocale must be in locales array
 * - If defaultLocale is provided:
 *   - locales is recommended (warning if missing)
 */
export function validateLocales(params: {
  defaultLocale?: string;
  locales?: string[];
}): ValidationResult[] {
  const results: ValidationResult[] = [];
  const { defaultLocale, locales } = params;

  // If locales array is provided
  if (locales && locales.length > 0) {
    // Check for duplicates in locales array
    const uniqueLocales = new Set(locales);
    if (uniqueLocales.size !== locales.length) {
      results.push({
        type: 'error',
        message: 'locales array contains duplicate values',
      });
    }

    // Validate locale format
    const localeRegex = /^[a-z]{2,3}(-[A-Z]{2,3})?(-[a-z]+)*$/;
    const invalidLocales = locales.filter(
      (locale) => !localeRegex.test(locale)
    );
    if (invalidLocales.length > 0) {
      results.push({
        type: 'error',
        message: `Invalid locale format: ${invalidLocales.join(', ')}. Expected format: 'en', 'en-US', 'fr-FR'`,
      });
    }

    // Check if defaultLocale is required and present
    if (!defaultLocale) {
      results.push({
        type: 'error',
        message: 'defaultLocale is required when locales array is provided',
      });
    } else {
      // Check if defaultLocale is in locales array
      if (!locales.includes(defaultLocale)) {
        results.push({
          type: 'error',
          message: 'defaultLocale must be included in the locales array',
        });
      }
    }
  }

  // If defaultLocale is provided but no locales
  if (defaultLocale && (!locales || locales.length === 0)) {
    results.push({
      type: 'warning',
      message: 'locales array is recommended when defaultLocale is specified',
    });

    // Validate defaultLocale format
    const localeRegex = /^[a-z]{2,3}(-[A-Z]{2,3})?(-[a-z]+)*$/;
    if (!localeRegex.test(defaultLocale)) {
      results.push({
        type: 'error',
        message: `Invalid defaultLocale format: ${defaultLocale}. Expected format: 'en', 'en-US', 'fr-FR'`,
      });
    }
  }

  return results;
}
