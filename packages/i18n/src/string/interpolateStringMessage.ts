import { getIntl } from '../i18n-config/singleton-operations';
import type { TranslationOptions } from '../translation-functions/types/options';

/**
 * String interpolation function
 */
export function interpolateStringMessage(
  encodedMsg: string,
  options: TranslationOptions
): string {
  return getIntl().formatCutoff(encodedMsg, {
    locales: options.$locale,
    maxChars: options.$maxChars,
  });
}
