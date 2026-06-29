import { formatCutoff } from '@generaltranslation/format';
import { TranslationOptions } from '../../types/options';

/**
 * String interpolation function
 */
export function interpolateStringMessage(
  encodedMsg: string,
  options: TranslationOptions
): string {
  const cutoffMessage = formatCutoff(encodedMsg, {
    locales: options.$locale,
    maxChars: options.$maxChars,
  });
  return cutoffMessage;
}
