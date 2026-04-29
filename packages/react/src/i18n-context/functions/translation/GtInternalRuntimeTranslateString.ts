import { tx } from 'gt-i18n/internal';
import type { RuntimeTranslationOptions } from 'gt-i18n/types';

/**
 * Internal runtime translate string function for dev only
 */
const GtInternalRuntimeTranslateString = (
  content: string,
  options: Omit<RuntimeTranslationOptions, '$locale'> = {}
) => {
  // Mark as ICU because that is the default format used for compiler collected translations (gt, t, msg)
  return tx(content, { $format: 'ICU', ...options });
};

export { GtInternalRuntimeTranslateString };
