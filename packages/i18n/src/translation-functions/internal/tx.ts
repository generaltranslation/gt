import { RuntimeTranslationOptions } from '../types/options';
import type { StringFormat } from '@generaltranslation/format/types';
import { resolveStringContentWithRuntimeFallback } from './helpers';
import { getI18nConfig } from '../../i18n-config/singleton-operations';
import { getWritableConditionStore } from '../../condition-store/singleton-operations';

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
  const conditionStore = getWritableConditionStore();
  const locale = conditionStore.getLocale();
  const enableI18n = conditionStore.getEnableI18n();

  return txInternal({ locale, enableI18n, content, options });
}

/**
 * Condition store agnostic tx function
 */
export async function txInternal({
  locale,
  enableI18n,
  content,
  options,
}: {
  locale: string;
  enableI18n: boolean;
  content: string;
  options: RuntimeTranslationOptionsWithFormat;
}): Promise<string> {
  const targetLocale = enableI18n
    ? typeof options.$locale === 'string'
      ? options.$locale
      : locale
    : getI18nConfig().getDefaultLocale();
  return resolveStringContentWithRuntimeFallback(targetLocale, content, {
    $format: 'STRING',
    ...options,
  });
}
