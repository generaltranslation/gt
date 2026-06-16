import { resolveStringContentWithFallback } from './internal/helpers';
import { InlineTranslationOptions } from './types/options';
import { getCurrentLocale } from '../i18n-manager/singleton-operations';
import { getDefaultStringFormat } from '@generaltranslation/format/internal';

/**
 * Translate a message
 * @param {string} message - The message to translate.
 * @param options - The options for the translation.
 * @returns The translated message.
 */
export function t(message: string, options: InlineTranslationOptions = {}) {
  const locale = options.$locale ?? getCurrentLocale();
  return resolveStringContentWithFallback(locale, message, {
    ...options,
    $format: options.$format ?? getDefaultStringFormat(),
  });
}
