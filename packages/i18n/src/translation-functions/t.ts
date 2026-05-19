import { resolveStringContentWithFallback } from './internal/helpers';
import { InlineTranslationOptions } from './types/options';
import { getLocale } from '../helpers/locale';

/**
 * Translate a message
 * @param {string} message - The message to translate.
 * @param options - The options for the translation.
 * @returns The translated message.
 */
export function t(message: string, options: InlineTranslationOptions = {}) {
  const locale = options.$locale ?? getLocale();
  return resolveStringContentWithFallback(locale, message, {
    $format: 'ICU',
    ...options,
  });
}
