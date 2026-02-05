import { isValidLocale } from 'generaltranslation';
import { getGTServicesEnabled } from '../../utils/getGTServicesEnabled';
import { ValidationResult } from '../types';
import { CustomMapping } from 'generaltranslation/types';

/**
 * Validate the locales configuration
 * @param params - The parameters to validate
 * @returns The validation results
 *
 * Only apply if using GT services
 */
export function validateLocales(params: {
  defaultLocale?: string;
  locales?: string[];
  customMapping?: CustomMapping;
  cacheUrl?: string | null;
  runtimeUrl?: string | null;
}): ValidationResult[] {
  const results: ValidationResult[] = [];
  if (!getGTServicesEnabled(params)) {
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
        message: `Invalid locale: ${locale}`,
      });
    }
  });

  return results;
}
