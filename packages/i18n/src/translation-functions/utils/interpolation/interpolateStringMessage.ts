import { formatCutoff } from '@generaltranslation/format';
import { InlineTranslationOptions } from '../../types/options';

/**
 * String interpolation function
 */
export function interpolateStringMessage(
  encodedMsg: string,
  options: InlineTranslationOptions
): string {
  const cutoffMessage = formatCutoff(encodedMsg, {
    locales: options.$locale,
    maxChars: options.$maxChars,
  });
  return cutoffMessage;
}
