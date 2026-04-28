import {
  _formatCutoff,
  _formatMessageICU,
  _formatMessageString,
} from './formatting/format';
import type { CutoffFormatOptions } from './formatting/custom-formats/CutoffFormat/types';
import { _isValidLocale, _standardizeLocale } from './locales/isValidLocale';
import { _resolveCanonicalLocale } from './locales/resolveCanonicalLocale';
import type { CustomMapping, FormatVariables } from './types';
import type { StringFormat } from './types-dir/jsx/content';

export {
  LocaleConfig,
  type LocaleConfigConstructorParams,
} from './LocaleConfig';

/**
 * Runtime-safe formatting and locale helpers.
 *
 * "Runtime-safe" means this entry point exposes only deterministic locale and
 * formatting primitives. It does not export the GT service client, project
 * credentials, network translation methods, file APIs, or other server/service
 * concerns from the root `generaltranslation` facade.
 *
 * This entry point is safe for browser-oriented and shared runtime packages to
 * import when they need locale metadata or formatting behavior without pulling
 * in the full translation API surface.
 */

/**
 * Formats a string with cutoff behavior, applying a terminator when the string exceeds the maximum character limit.
 *
 * This standalone function provides cutoff formatting functionality without requiring a GT instance.
 * The locales parameter is required for proper terminator selection based on the target language.
 *
 * @param {string} value - The string value to format with cutoff behavior.
 * @param {Object} [options] - Configuration options for cutoff formatting.
 * @param {string | string[]} [options.locales] - The locales to use for terminator selection.
 * @param {number} [options.maxChars] - The maximum number of characters to display.
 * - Undefined values are treated as no cutoff.
 * - Negative values follow .slice() behavior and terminator will be added before the value.
 * - 0 will result in an empty string.
 * - If cutoff results in an empty string, no terminator is added.
 * @param {CutoffFormatStyle} [options.style='ellipsis'] - The style of the terminator.
 * @param {string} [options.terminator] - Optional override the terminator to use.
 * @param {string} [options.separator] - Optional override the separator to use between the terminator and the value.
 * - If no terminator is provided, then separator is ignored.
 * @returns {string} The formatted string with terminator applied if cutoff occurs.
 *
 * @example
 * formatCutoff('Hello, world!', { locales: 'en-US', maxChars: 8 });
 * // Returns: 'Hello, w...'
 *
 * @example
 * formatCutoff('Hello, world!', { locales: 'en-US', maxChars: -3 });
 * // Returns: '...ld!'
 *
 * @example
 * formatCutoff('Very long text that needs cutting', {
 *   locales: 'en-US',
 *   maxChars: 15,
 *   style: 'ellipsis',
 *   separator: ' '
 * });
 * // Returns: 'Very long text ...'
 */
export function formatCutoff(
  value: string,
  options?: {
    locales?: string | string[];
  } & CutoffFormatOptions
) {
  return _formatCutoff({ value, locales: options?.locales, options });
}

/**
 * Formats a message according to the specified locales and options.
 *
 * @param {string} message - The message to format.
 * @param {Object} [options] - Configuration options for message formatting.
 * @param {string | string[]} [options.locales] - The locales to use for formatting.
 * @param {FormatVariables} [options.variables] - The variables to use for formatting.
 * @param {StringFormat} [options.dataFormat='ICU'] - The format of the message. When STRING, the message is returned as is.
 * @returns {string} The formatted message.
 *
 * @example
 * formatMessage('Hello {name}', { variables: { name: 'John' } });
 * // Returns: "Hello John"
 *
 * @example
 * formatMessage('Hello {name}', {
 *   locales: ['fr'],
 *   variables: { name: 'John' }
 * });
 */
export function formatMessage(
  message: string,
  options?: {
    locales?: string | string[];
    variables?: FormatVariables;
    dataFormat?: StringFormat;
  }
) {
  switch (options?.dataFormat) {
    case 'STRING':
      return _formatMessageString(message);
    default:
      return _formatMessageICU(message, options?.locales, options?.variables);
  }
}

/**
 * Checks if a given BCP 47 locale code is valid.
 * @param {string} locale - The BCP 47 locale code to validate.
 * @param {CustomMapping} [customMapping] - The custom mapping to use for validation.
 * @returns {boolean} True if the BCP 47 code is valid, false otherwise.
 */
export function isValidLocale(locale: string, customMapping?: CustomMapping) {
  return _isValidLocale(locale, customMapping);
}

/**
 * Resolves the canonical locale for a given locale.
 * @param {string} locale - The locale to resolve the canonical locale for.
 * @param {CustomMapping} [customMapping] - The custom mapping to use for resolving the canonical locale.
 * @returns {string} The canonical locale.
 */
export function resolveCanonicalLocale(
  locale: string,
  customMapping?: CustomMapping
) {
  return _resolveCanonicalLocale(locale, customMapping);
}

/**
 * Standardizes a BCP 47 locale code to ensure correct formatting.
 * @param {string} locale - The BCP 47 locale code to standardize.
 * @returns {string} The standardized BCP 47 locale code or an empty string if it is an invalid code.
 */
export function standardizeLocale(locale: string) {
  return _standardizeLocale(locale);
}
