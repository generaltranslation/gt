import { LookupOptions, RuntimeTranslationOptions } from '../types/options';
import { getI18nManager } from '../../i18n-manager/singleton-operations';
import { interpolateMessage } from '../utils/interpolation/interpolateMessage';
import { DataFormat, JsxChildren } from 'generaltranslation/types';

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
  options?: RuntimeTranslationOptions
): Promise<string>;

export async function tx(
  content: JsxChildren,
  options?: RuntimeTranslationOptions & { $format: 'JSX' }
): Promise<JsxChildren>;

export async function tx<T extends DataFormat>(
  content: T extends 'JSX' ? JsxChildren : string,
  options?: T extends 'JSX'
    ? RuntimeTranslationOptions & { $format: 'JSX' }
    : RuntimeTranslationOptions
): Promise<T extends 'JSX' ? JsxChildren : string> {
  const resolutionOptions: LookupOptions = {
    $format: 'STRING',
    ...options,
  };

  // Lookup translation
  const i18nManager = getI18nManager();
  const translation = await i18nManager.lookupTranslationWithFallback(
    content,
    resolutionOptions
  );

  // No interpolation for JSX
  if (resolutionOptions.$format === 'JSX') {
    return translation ?? content;
  }

  // Format result
  return interpolateMessage({
    source: content as string,
    target: translation as string | undefined,
    options: resolutionOptions,
  });
}
