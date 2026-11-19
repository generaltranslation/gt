import { formatCutoff } from './formatCutoff';
import type { TranslationOptions } from '../translation-functions/types/options';

/**
 * String interpolation function
 */
export function interpolateStringMessage(
  encodedMsg: string,
  options: TranslationOptions
): string {
  return formatCutoff(encodedMsg, options.$maxChars, options.$locale);
}
