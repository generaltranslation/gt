import {
  _formatCurrency,
  _formatDateTime,
  _formatList,
  _formatListToParts,
  _formatMessageICU,
  _formatNum,
  _formatRelativeTime,
  _selectRelativeTimeUnit,
} from './formatting/format';
import type { CutoffFormatOptions } from './formatting/custom-formats/CutoffFormat/types';
import { cutoffFormatCache } from './formatting/custom-formats/CutoffFormat/CutoffFormatCache';
import { _determineLocale } from './locales/determineLocale';
import { _getLocaleDirection } from './locales/getLocaleDirection';
import { _getLocaleEmoji } from './locales/getLocaleEmoji';
import {
  _getLocaleProperties,
  type LocaleProperties,
} from './locales/getLocaleProperties';
import { _getLocaleName } from './locales/getLocaleName';
import { _isSameDialect } from './locales/isSameDialect';
import { _isSameLanguage } from './locales/isSameLanguage';
import { _isSupersetLocale } from './locales/isSupersetLocale';
import { _isValidLocale, _standardizeLocale } from './locales/isValidLocale';
import { _requiresTranslation } from './locales/requiresTranslation';
import { _resolveAliasLocale } from './locales/resolveAliasLocale';
import { _resolveCanonicalLocale } from './locales/resolveCanonicalLocale';
import type { CustomMapping, FormatVariables } from './types';
import type { StringFormat } from './types-dir/jsx/content';

export {
  LocaleConfig,
  type LocaleConfigConstructorParams,
} from './LocaleConfig';
export {
  getRegionProperties,
  type CustomRegionMapping,
} from './locales/getRegionProperties';

type LocalesOption = {
  locales?: string | string[];
};

type MessageFormatOptions = LocalesOption & {
  variables?: FormatVariables;
  dataFormat?: StringFormat;
};

/**
 * Core formatting and locale helpers.
 *
 * This entry point exposes deterministic locale and formatting primitives. It
 * does not export the GT service client, project credentials, network
 * translation methods, file APIs, or other server/service concerns from the
 * root `generaltranslation` facade.
 *
 * This entry point is intended for framework and shared packages that need
 * locale metadata or formatting behavior without pulling in the full
 * translation API surface.
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
 * // Returns: 'Hello, …'
 *
 * @example
 * formatCutoff('Hello, world!', { locales: 'en-US', maxChars: -3 });
 * // Returns: '…d!'
 *
 * @example
 * formatCutoff('Very long text that needs cutting', {
 *   locales: 'en-US',
 *   maxChars: 15,
 *   style: 'ellipsis',
 *   separator: ' '
 * });
 * // Returns: 'Very long tex …'
 */
export function formatCutoff(
  value: string,
  options?: LocalesOption & CutoffFormatOptions
) {
  const { locales, ...formatOptions } = options ?? {};
  return cutoffFormatCache.get(locales, formatOptions).format(value);
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
export function formatMessage(message: string, options?: MessageFormatOptions) {
  if (options?.dataFormat === 'STRING') return message;
  return _formatMessageICU(message, options?.locales, options?.variables);
}

/**
 * Formats a number according to the specified locales and options.
 * @param {Object} params - The parameters for the number formatting.
 * @param {number} params.value - The number to format.
 * @param {Intl.NumberFormatOptions} [params.options] - Additional options for number formatting.
 * @param {string | string[]} [params.options.locales] - The locales to use for formatting.
 * @returns {string} The formatted number.
 */
export function formatNum(
  number: number,
  options?: LocalesOption & Intl.NumberFormatOptions
): string {
  const { locales, ...intlOptions } = options ?? {};
  return _formatNum({
    value: number,
    locales,
    options: intlOptions,
  });
}

/**
 * Formats a date according to the specified languages and options.
 * @param {Object} params - The parameters for the date formatting.
 * @param {Date} params.value - The date to format.
 * @param {Intl.DateTimeFormatOptions} [params.options] - Additional options for date formatting.
 * @param {string | string[]} [params.options.locales] - The languages to use for formatting.
 * @returns {string} The formatted date.
 */
export function formatDateTime(
  date: Date,
  options?: LocalesOption & Intl.DateTimeFormatOptions
): string {
  const { locales, ...intlOptions } = options ?? {};
  return _formatDateTime({
    value: date,
    locales,
    options: intlOptions,
  });
}

/**
 * Formats a currency value according to the specified languages, currency, and options.
 * @param {Object} params - The parameters for the currency formatting.
 * @param {number} params.value - The currency value to format.
 * @param {string} params.currency - The currency code (e.g., 'USD').
 * @param {Intl.NumberFormatOptions} [params.options={}] - Additional options for currency formatting.
 * @param {string | string[]} [params.options.locales] - The locale codes to use for formatting.
 * @returns {string} The formatted currency value.
 */
export function formatCurrency(
  value: number,
  currency: string,
  options?: LocalesOption & Intl.NumberFormatOptions
): string {
  const { locales, ...intlOptions } = options ?? {};
  return _formatCurrency({
    value,
    currency,
    locales,
    options: intlOptions,
  });
}

/**
 * Formats a list of items according to the specified locales and options.
 * @param {Object} params - The parameters for the list formatting.
 * @param {Array<string | number>} params.value - The list of items to format.
 * @param {Intl.ListFormatOptions} [params.options={}] - Additional options for list formatting.
 * @param {string | string[]} [params.options.locales] - The locales to use for formatting.
 * @returns {string} The formatted list.
 */
export function formatList(
  array: Array<string | number>,
  options?: LocalesOption & Intl.ListFormatOptions
): string {
  const { locales, ...intlOptions } = options ?? {};
  return _formatList({
    value: array,
    locales,
    options: intlOptions,
  });
}

/**
 * Formats a list of items according to the specified locales and options.
 * @param {Array<T>} array - The list of items to format.
 * @param {Object} [options] - Additional options for list formatting.
 * @param {string | string[]} [options.locales] - The locales to use for formatting.
 * @param {Intl.ListFormatOptions} [options] - Additional Intl.ListFormat options.
 * @returns {Array<T | string>} The formatted list parts.
 */
export function formatListToParts<T>(
  array: Array<T>,
  options?: LocalesOption & Intl.ListFormatOptions
): Array<T | string> {
  const { locales, ...intlOptions } = options ?? {};
  return _formatListToParts<T>({
    value: array,
    locales,
    options: intlOptions,
  });
}

/**
 * Formats a relative time value according to the specified locales and options.
 * @param {Object} params - The parameters for the relative time formatting.
 * @param {number} params.value - The relative time value to format.
 * @param {Intl.RelativeTimeFormatUnit} params.unit - The unit of time (e.g., 'second', 'minute', 'hour', 'day', 'week', 'month', 'year').
 * @param {Intl.RelativeTimeFormatOptions} [params.options={}] - Additional options for relative time formatting.
 * @param {string | string[]} [params.options.locales] - The locales to use for formatting.
 * @returns {string} The formatted relative time string.
 */
export function formatRelativeTime(
  value: number,
  unit: Intl.RelativeTimeFormatUnit,
  options?: LocalesOption & Omit<Intl.RelativeTimeFormatOptions, 'locales'>
): string {
  const { locales, ...intlOptions } = options ?? {};
  return _formatRelativeTime({
    value,
    unit,
    locales,
    options: intlOptions,
  });
}

/**
 * Formats a relative time string from a Date, automatically selecting the best unit.
 * @param {Date} date - The date to format relative to now.
 * @param {Object} [options] - Formatting options.
 * @param {string | string[]} [options.locales] - The locales to use for formatting.
 * @param {Intl.RelativeTimeFormatOptions} [options] - Additional Intl.RelativeTimeFormat options.
 * @returns {string} The formatted relative time string (e.g., "2 hours ago", "in 3 days").
 */
export function formatRelativeTimeFromDate(
  date: Date,
  options?: LocalesOption &
    Omit<Intl.RelativeTimeFormatOptions, 'locales'> & {
      baseDate?: Date;
    }
): string {
  const { locales, baseDate, ...intlOptions } = options ?? {};
  const { value, unit } = _selectRelativeTimeUnit(date, baseDate ?? new Date());
  return _formatRelativeTime({
    value,
    unit,
    locales,
    options: intlOptions,
  });
}

/**
 * Checks if a given BCP 47 locale code is valid.
 *
 * @param {string} locale - The BCP 47 locale code to validate.
 * @param {CustomMapping} [customMapping] - The custom mapping to use for validation.
 * @returns {boolean} True if the BCP 47 code is valid, false otherwise.
 *
 * @example
 * isValidLocale('en-US');
 * // Returns: true
 *
 * @example
 * isValidLocale('en_US');
 * // Returns: false
 */
export function isValidLocale(locale: string, customMapping?: CustomMapping) {
  return _isValidLocale(locale, customMapping);
}

/**
 * Resolves the canonical locale for a given locale.
 *
 * @param {string} locale - The locale to resolve the canonical locale for.
 * @param {CustomMapping} [customMapping] - The custom mapping to use for resolving the canonical locale.
 * @returns {string} The canonical locale, or the input locale when no canonical mapping exists.
 *
 * @example
 * resolveCanonicalLocale('en-US');
 * // Returns: 'en-US'
 *
 * @example
 * resolveCanonicalLocale('en', { en: 'en-US' });
 * // Returns: 'en-US'
 */
export function resolveCanonicalLocale(
  locale: string,
  customMapping?: CustomMapping
) {
  return _resolveCanonicalLocale(locale, customMapping);
}

/**
 * Standardizes a BCP 47 locale code to ensure correct formatting.
 *
 * @param {string} locale - The BCP 47 locale code to standardize.
 * @returns {string} The standardized BCP 47 locale code, or the input string if it cannot be standardized.
 *
 * @example
 * standardizeLocale('en-us');
 * // Returns: 'en-US'
 *
 * @example
 * standardizeLocale('not a locale');
 * // Returns: 'not a locale'
 */
export function standardizeLocale(locale: string) {
  return _standardizeLocale(locale);
}

// -------------- Locale Properties -------------- //

/**
 * Retrieves the display name of locale code using Intl.DisplayNames.
 *
 * @param {string} locale - A BCP-47 locale code.
 * @param {string} [defaultLocale] - The default locale to use for formatting.
 * @param {CustomMapping} [customMapping] - A custom mapping of locale codes to their names.
 * @returns {string} The display name corresponding to the code.
 */
export function getLocaleName(
  locale: string,
  defaultLocale?: string,
  customMapping?: CustomMapping
): string {
  return _getLocaleName(locale, defaultLocale, customMapping);
}

/**
 * Retrieves an emoji based on a given locale code, taking into account region, language, and specific exceptions.
 *
 * This function uses the locale's region (if present) to select an emoji or falls back on default emojis for certain languages.
 *
 * @param locale - A string representing the locale code (e.g., 'en-US', 'fr-CA').
 * @param {CustomMapping} [customMapping] - A custom mapping of locale codes to their names.
 * @returns The emoji representing the locale or its region, or a default emoji if no specific match is found.
 */
export function getLocaleEmoji(
  locale: string,
  customMapping?: CustomMapping
): string {
  return _getLocaleEmoji(locale, customMapping);
}

/**
 * Generates linguistic details for a given locale code.
 *
 * This function returns information about the locale,
 * script, and region of a given language code both in a standard form and in a maximized form (with likely script and region).
 * The function provides these names in both your default language and native forms, and an associated emoji.
 *
 * @param {string} locale - The locale code to get properties for (e.g., "de-AT").
 * @param {string} [defaultLocale] - The default locale to use for formatting.
 * @param {CustomMapping} [customMapping] - A custom mapping of locale codes to their names.
 * @returns {LocaleProperties} - An object containing detailed information about the locale.
 *
 * @property {string} code - The full locale code, e.g., "de-AT".
 * @property {string} name - Language name in the default display language, e.g., "Austrian German".
 * @property {string} nativeName - Language name in the locale's native language, e.g., "Österreichisches Deutsch".
 * @property {string} languageCode - The base language code, e.g., "de".
 * @property {string} languageName - The language name in the default display language, e.g., "German".
 * @property {string} nativeLanguageName - The language name in the native language, e.g., "Deutsch".
 * @property {string} nameWithRegionCode - Language name with region in the default language, e.g., "German (AT)".
 * @property {string} nativeNameWithRegionCode - Language name with region in the native language, e.g., "Deutsch (AT)".
 * @property {string} regionCode - The region code from maximization, e.g., "AT".
 * @property {string} regionName - The region name in the default display language, e.g., "Austria".
 * @property {string} nativeRegionName - The region name in the native language, e.g., "Österreich".
 * @property {string} scriptCode - The script code from maximization, e.g., "Latn".
 * @property {string} scriptName - The script name in the default display language, e.g., "Latin".
 * @property {string} nativeScriptName - The script name in the native language, e.g., "Lateinisch".
 * @property {string} maximizedCode - The maximized locale code, e.g., "de-Latn-AT".
 * @property {string} maximizedName - Maximized locale name with likely script in the default language, e.g., "Austrian German (Latin)".
 * @property {string} nativeMaximizedName - Maximized locale name in the native language, e.g., "Österreichisches Deutsch (Lateinisch)".
 * @property {string} minimizedCode - Minimized locale code, e.g., "de-AT" (or "de" for "de-DE").
 * @property {string} minimizedName - Minimized language name in the default language, e.g., "Austrian German".
 * @property {string} nativeMinimizedName - Minimized language name in the native language, e.g., "Österreichisches Deutsch".
 * @property {string} emoji - The emoji associated with the locale's region, if applicable.
 */
export function getLocaleProperties(
  locale: string,
  defaultLocale?: string,
  customMapping?: CustomMapping
): LocaleProperties {
  return _getLocaleProperties(locale, defaultLocale, customMapping);
}

/**
 * Determines whether a translation is required based on the source and target locales.
 *
 * - If the target locale is not specified, the function returns `false`, as translation is not needed.
 * - If the source and target locale are the same, returns `false`, indicating that no translation is necessary.
 * - If the `approvedLocales` array is provided, and the target locale is not within that array, the function also returns `false`.
 * - Otherwise, it returns `true`, meaning that a translation is required.
 *
 * @param {string} sourceLocale - The locale code for the original content (BCP 47 locale code).
 * @param {string} targetLocale - The locale code of the language to translate the content into (BCP 47 locale code).
 * @param {string[]} [approvedLocale] - An optional array of approved target locales.
 *
 * @returns {boolean} - Returns `true` if translation is required, otherwise `false`.
 */
export function requiresTranslation(
  sourceLocale: string,
  targetLocale: string,
  approvedLocales?: string[],
  customMapping?: CustomMapping
): boolean {
  return _requiresTranslation(
    sourceLocale,
    targetLocale,
    approvedLocales,
    customMapping
  );
}

/**
 * Determines the best matching locale from the provided approved locales list.
 * @param {string | string[]} locales - A single locale or an array of locales sorted in preference order.
 * @param {string[]} [approvedLocales=this.locales] - An array of approved locales, also sorted by preference.
 * @returns {string | undefined} - The best matching locale from the approvedLocales list, or undefined if no match is found.
 */
export function determineLocale(
  locales: string | string[],
  approvedLocales: string[] | undefined = [],
  customMapping: CustomMapping | undefined = undefined
): string | undefined {
  return _determineLocale(locales, approvedLocales, customMapping);
}

/**
 * Get the text direction for a given locale code using the Intl.Locale API.
 *
 * @param {string} locale - A BCP-47 locale code.
 * @returns {string} 'rtl' if the locale is right-to-left; otherwise 'ltr'.
 */
export function getLocaleDirection(locale: string): 'ltr' | 'rtl' {
  return _getLocaleDirection(locale);
}

/**
 * Resolves the alias locale for a given locale.
 * @param {string} locale - The locale to resolve the alias locale for
 * @param {CustomMapping} [customMapping] - The custom mapping to use for resolving the alias locale
 * @returns {string} The alias locale
 */
export function resolveAliasLocale(
  locale: string,
  customMapping?: CustomMapping
): string {
  return _resolveAliasLocale(locale, customMapping);
}

/**
 * Checks if multiple BCP 47 locale codes represent the same dialect.
 * @param {string[]} locales - The BCP 47 locale codes to compare.
 * @returns {boolean} True if all BCP 47 codes represent the same dialect, false otherwise.
 */
export function isSameDialect(...locales: (string | string[])[]): boolean {
  return _isSameDialect(...locales);
}

/**
 * Checks if multiple BCP 47 locale codes represent the same language.
 * @param {string[]} locales - The BCP 47 locale codes to compare.
 * @returns {boolean} True if all BCP 47 codes represent the same language, false otherwise.
 */
export function isSameLanguage(...locales: (string | string[])[]): boolean {
  return _isSameLanguage(...locales);
}

/**
 * Checks if a locale is a superset of another locale.
 * A subLocale is a subset of superLocale if it is an extension of superLocale or are otherwise identical.
 *
 * @param {string} superLocale - The locale to check if it is a superset of the other locale.
 * @param {string} subLocale - The locale to check if it is a subset of the other locale.
 * @returns {boolean} True if the first locale is a superset of the second locale, false otherwise.
 */
export function isSupersetLocale(
  superLocale: string,
  subLocale: string
): boolean {
  return _isSupersetLocale(superLocale, subLocale);
}
