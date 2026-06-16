import type {
  FormatVariables,
  StringFormat,
} from '@generaltranslation/format/types';
import { txInternal } from 'gt-i18n/internal';
import { getRequestConditions } from '../../request/getRequestConditions';

type TxOptions = FormatVariables & {
  $locale?: string;
  $context?: string;
  $maxChars?: number;
  $format?: StringFormat;
};

/**
 * Translates the provided content string based on the specified locale and options.
 * If no translation is required, it renders the content as is. Otherwise, it fetches the
 * required translations or falls back to on-demand translation if enabled.
 *
 * @async
 * @function tx (translate)
 *
 * @param {string} content - The content string that needs to be translated.
 * @param {Object} [options] - Translation options.
 * @param {string} [options.locale] - The target locale for translation. Defaults to the current locale if not provided.
 * @param {string} [options.context] - Additional context for the translation process, which may influence the translation's outcome.
 * @param {number} [options.maxChars] - The maximum number of characters to translate.
 * @param {Object} [options.variables] - An optional map of variables to be injected into the translated content.
 * @param {Object} [options.variableOptions] - Options for formatting numbers and dates using `Intl.NumberFormat` or `Intl.DateTimeFormat`.
 * @param {StringFormat} [options.$format] - The data format for the message (e.g., 'ICU', 'STRING'). Defaults to 'ICU'.
 *
 * @returns {Promise<string>} - A promise that resolves to the translated content string, or the original content if no translation is needed.
 *
 * @throws {Error} - Throws an error if the translation process fails or if there are issues with fetching necessary data.
 *
 * @example
 * // Basic usage with default locale detection
 * const translation = await tx("Hello, world!");
 *
 * @example
 * // Providing specific translation options
 * const translation = await tx("Hello, world!", { locale: 'es', context: 'Translate informally' });
 *
 * @example
 * // Using variables in the content string
 * const translation = await tx("The price is {price}", { locale: 'es-MX', variables: { price: 29.99 } });
 */
export async function tx(
  message: string,
  options: TxOptions = {}
): Promise<string> {
  const { _locale, _enableI18n } = await getRequestConditions();
  return txInternal({
    locale: _locale,
    enableI18n: _enableI18n,
    content: message,
    options,
  });
}
