import { RuntimeTranslationOptions } from '../types/options';
import type { StringFormat } from '@generaltranslation/format/types';
import { resolveStringContentWithRuntimeFallback } from './helpers';
import {
  getCurrentLocale,
  getI18nManager,
} from '../../i18n-manager/singleton-operations';

type RuntimeTranslationOptionsWithFormat = Omit<
  RuntimeTranslationOptions,
  '$format'
> & {
  $format?: StringFormat;
};

/**
 * Translates a message at runtime.
 * @param {string} message - The message to translate.
 * @param {RuntimeTranslationOptions} options - The options for the translation.
 * @returns {Promise<string>} The translated message.
 *
 * @example
 * // Simple runtime translation without interpolation
 * const status = await tx('Processing complete', { $locale: 'es-MX' });
 *
 * @example
 * // Runtime translation with interpolation
 * const progress = await tx(`Processing ${status}`, { $locale: 'es-MX' });
 */
export async function tx(
  content: string,
  options: RuntimeTranslationOptionsWithFormat = {}
): Promise<string> {
  const locale =
    typeof options.$locale === 'string' ? options.$locale : getCurrentLocale();
  const defaultStringFormat = getI18nManager().getDefaultStringFormat();
  return resolveStringContentWithRuntimeFallback(locale, content, {
    ...options,
    $format:
      options.$format ??
      (defaultStringFormat === 'ICU' ? 'STRING' : defaultStringFormat),
  });
}
