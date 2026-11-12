import { formatCutoff } from '../formatCutoff';
import { TranslationOptions } from '../../types/options';

/**
 * String interpolation function
 */
export function interpolateStringMessage(
  encodedMsg: string,
  options: TranslationOptions
): string {
  return formatCutoff(encodedMsg, options.$maxChars, options.$locale);
}
