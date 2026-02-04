import { TranslationsLoader } from '../../translations-manager/translations-loaders/types';
import { LoadTranslationsType } from '../../utils/getLoadTranslationsType';
import { getLoadTranslationsType } from '../../utils/getLoadTranslationsType';
import { ValidationResult } from '../types';

/**
 * Load translation configuration
 *
 * Types of load translations:
 * - GT_REMOTE: use the default CDN URL {@link defaultCacheUrl}
 * - REMOTE: use a custom CDN URL
 * - CUSTOM: use a custom translations loader
 * - DISABLED: no translations loading
 *
 * Requirements:
 * - REMOTE:
 * - GT_REMOTE:
 *   - projectId is required
 * - CUSTOM:
 *   - customTranslationLoader is required
 * - DISABLED:
 *   - no requirements
 */
export function validateLoadTranslations(params: {
  projectId?: string;
  cacheUrl?: string | null;
  customTranslationLoader?: TranslationsLoader;
}): ValidationResult[] {
  const results: ValidationResult[] = [];
  const { projectId, customTranslationLoader } = params;

  const loadTranslationsType = getLoadTranslationsType(params);
  switch (loadTranslationsType) {
    case LoadTranslationsType.REMOTE:
    case LoadTranslationsType.GT_REMOTE:
      if (!projectId) {
        results.push({
          type: 'error',
          message:
            'projectId is required when loading translations from a remote store',
        });
      }
      break;
    case LoadTranslationsType.CUSTOM:
      if (!customTranslationLoader) {
        results.push({
          type: 'error',
          message:
            'customTranslationLoader is required when loading translations from a custom loader',
        });
      }
      break;
    case LoadTranslationsType.DISABLED:
      break;
  }

  return results;
}
