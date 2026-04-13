import { RuntimeTranslationOptions } from '../types/options';
import { StringFormat } from 'generaltranslation/types';
import { resolveStringContentWithRuntimeFallback } from './helpers';

/**
 * Translates a message at runtime.
 * @param {string} message - The message to translate.
 * @param {RuntimeTranslationOptions} options - The options for the translation.
 * @returns {Promise<string>} The translated message.
 *
 * @example
 * // Simple runtime translation without interpolation
 * const status = await tx('Processing complete');
 *
 * @example
 * // Runtime translation with interpolation
 * const progress = await tx(`Processing ${status}`, { $locale: 'es-MX' });
 */
export async function tx(
  content: string,
  options?: Omit<RuntimeTranslationOptions, '$format'> & {
    $format?: StringFormat;
  }
): Promise<string> {
  return resolveStringContentWithRuntimeFallback(content, {
    $format: 'ICU',
    ...options,
  });
}
