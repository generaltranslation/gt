import { ValidationResult } from '../types';
import { createDiagnosticMessage } from 'generaltranslation/internal';
import {
  TranslationApiType,
  getTranslationApiType,
} from '../../utils/getTranslationApiType';

/**
 * Validate the translation API configuration
 * @param params - The parameters to validate
 * @returns The validation results
 *
 * Types of translation API:
 * - GT: use the default runtime API URL {@link defaultRuntimeApiUrl}
 * - CUSTOM: use a custom runtime API URL
 * - DISABLED: no runtime API translation
 *
 * Requirements:
 * - CUSTOM:
 * - GT:
 *   - projectId is needed
 *   - devApiKey or apiKey is needed
 * - DISABLED:
 *   - no requirements
 *
 * TODO: reject dev api key in production
 */
export function validateTranslationApi(params: {
  projectId?: string;
  devApiKey?: string;
  apiKey?: string;
  runtimeUrl?: string | null;
}): ValidationResult[] {
  const results: ValidationResult[] = [];

  const translationApiType = getTranslationApiType(params);

  switch (translationApiType) {
    case TranslationApiType.CUSTOM:
    case TranslationApiType.GT:
      if (!params.projectId) {
        results.push({
          type: 'warning',
          message: createDiagnosticMessage({
            whatHappened: 'Runtime translation needs a projectId',
            fix: 'Add projectId to the I18nManager config or disable runtime translation',
          }),
        });
      }
      if (!params.devApiKey && !params.apiKey) {
        results.push({
          type: 'warning',
          message: createDiagnosticMessage({
            whatHappened: 'Runtime translation needs devApiKey or apiKey',
            fix: 'Add credentials to the I18nManager config or disable runtime translation',
          }),
        });
      }
      break;
    case TranslationApiType.DISABLED:
      break;
  }
  return results;
}
