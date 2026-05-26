import { TranslationsLoader } from '../../translations-manager/translations-loaders/types';
import { LoadTranslationsType } from '../../utils/getLoadTranslationsType';
import { getLoadTranslationsType } from '../../utils/getLoadTranslationsType';
import { ValidationResult } from '../types';
import { createDiagnosticMessage } from 'generaltranslation/internal';

/**
 * Load translation configuration
 *
 * Types of load translations:
 * - GT_REMOTE: use the default remote store URL {@link defaultCacheUrl}
 * - REMOTE: use a custom remote store URL
 * - CUSTOM: use a custom translations loader
 * - DISABLED: no translations loading
 *
 * Requirements:
 * - REMOTE:
 * - GT_REMOTE:
 *   - projectId is needed
 * - CUSTOM:
 *   - loadTranslations is needed
 * - DISABLED:
 *   - no requirements
 */
export function validateLoadTranslations(params: {
  projectId?: string;
  cacheUrl?: string | null;
  loadTranslations?: TranslationsLoader;
}): ValidationResult[] {
  const results: ValidationResult[] = [];
  const { projectId, loadTranslations } = params;

  const loadTranslationsType = getLoadTranslationsType(params);
  switch (loadTranslationsType) {
    case LoadTranslationsType.REMOTE:
    case LoadTranslationsType.GT_REMOTE:
      if (!projectId) {
        results.push({
          type: 'warning',
          message: createDiagnosticMessage({
            whatHappened:
              'Loading translations from a remote store needs a projectId',
            fix: 'Add projectId to the I18nManager config or disable remote translation loading',
          }),
        });
      }
      break;
    case LoadTranslationsType.CUSTOM:
      if (!loadTranslations) {
        results.push({
          type: 'error',
          message: createDiagnosticMessage({
            whatHappened: 'Custom translation loading needs loadTranslations',
            fix: 'Provide a loadTranslations function or disable custom translation loading',
          }),
        });
      }
      break;
    case LoadTranslationsType.DISABLED:
      break;
  }

  return results;
}
