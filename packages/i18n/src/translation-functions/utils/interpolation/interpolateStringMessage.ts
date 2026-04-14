import { formatCutoff } from 'generaltranslation';
import { InlineTranslationOptions } from '../../types/options';

/**
 * String interpolation function
 */
export function interpolateStringMessage(
  encodedMsg: string,
  options: InlineTranslationOptions
): string {
  const cutoffMessage = formatCutoff(encodedMsg, {
    locales: options.$locale ?? options.$_locales,
    maxChars: options.$maxChars,
  });
  return cutoffMessage;
}
