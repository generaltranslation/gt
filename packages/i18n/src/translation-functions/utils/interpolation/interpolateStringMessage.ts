import { formatCutoff } from '@generaltranslation/format';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import { TranslationOptions } from '../../types/options';

/**
 * String interpolation function
 */
export function interpolateStringMessage(
  encodedMsg: string,
  options: TranslationOptions
): string {
  const cutoffMessage = formatCutoff(encodedMsg, {
    locales: options.$locale ?? libraryDefaultLocale,
    maxChars: options.$maxChars,
  });
  return cutoffMessage;
}
