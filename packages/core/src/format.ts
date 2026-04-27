// `generaltranslation` language toolkit
// © 2026, General Translation, Inc.

import _requiresTranslation from './locales/requiresTranslation';
import _determineLocale from './locales/determineLocale';
import {
  _formatNum,
  _formatCurrency,
  _formatList,
  _formatRelativeTime,
  _formatRelativeTimeFromDate,
  _formatDateTime,
  _formatListToParts,
  _formatCutoff,
  _formatMessageICU,
  _formatMessageString,
} from './formatting/format';
import { CustomMapping, FormatVariables } from './types';
import _isSameLanguage from './locales/isSameLanguage';
import _getLocaleProperties, {
  LocaleProperties,
} from './locales/getLocaleProperties';
import _getLocaleEmoji from './locales/getLocaleEmoji';
import { _isValidLocale, _standardizeLocale } from './locales/isValidLocale';
import { _getLocaleName } from './locales/getLocaleName';
import { _getLocaleDirection } from './locales/getLocaleDirection';
import { libraryDefaultLocale } from './internal';
import _isSameDialect from './locales/isSameDialect';
import _isSupersetLocale from './locales/isSupersetLocale';
import {
  noSourceLocaleProvidedError,
  noTargetLocaleProvidedError,
  invalidLocaleError,
  invalidLocalesError,
} from './logging/errors';
import {
  _getRegionProperties,
  CustomRegionMapping,
} from './locales/getRegionProperties';
import { _resolveAliasLocale } from './locales/resolveAliasLocale';
import { _resolveCanonicalLocale } from './locales/resolveCanonicalLocale';
import { CutoffFormatOptions } from './formatting/custom-formats/CutoffFormat/types';
import { StringFormat } from './types-dir/jsx/content';

/**
 * Type representing the constructor parameters for the GTFormatter class.
 * @typedef {Object} GTFormatterConstructorParams
 * @property {string} [sourceLocale] - The default source locale for translations
 * @property {string} [targetLocale] - The default target locale for translations
 * @property {string[]} [locales] - Array of supported locales
 * @property {CustomMapping} [customMapping] - Custom mapping of locale codes to their names
 */
export type GTFormatterConstructorParams = {
  sourceLocale?: string;
  targetLocale?: string;
  locales?: string[];
  customMapping?: CustomMapping;
};

/**
 * GTFormatter is a lightweight class for locale management and formatting.
 * It provides all formatting and locale utility methods without the API client overhead.
 * Use this instead of GT on the client side to reduce bundle size.
 *
 * @class GTFormatter
 */
export class GTFormatter {
  /** Source locale for translations */
  sourceLocale?: string;

  /** Target locale for translations */
  targetLocale?: string;

  /** Array of supported locales */
  locales?: string[];

  /** Array of locales used for rendering variables */
  _renderingLocales: string[] = [];

  /** Custom mapping for locale codes to their names */
  customMapping?: CustomMapping;

  /** Lazily derived reverse custom mapping for alias locales */
  reverseCustomMapping?: Record<string, string>;

  /** Lazily derived custom mapping for regions */
  customRegionMapping?: CustomRegionMapping;

  constructor(params: GTFormatterConstructorParams = {}) {
    this.setConfig(params);
  }

  setConfig({
    sourceLocale,
    targetLocale,
    locales,
    customMapping,
  }: GTFormatterConstructorParams) {
    // ----- Standardize locales ----- //

    // source locale
    if (sourceLocale) {
      this.sourceLocale = _standardizeLocale(sourceLocale);
      if (!_isValidLocale(this.sourceLocale, customMapping))
        throw new Error(invalidLocaleError(this.sourceLocale));
    }

    // target locale
    if (targetLocale) {
      this.targetLocale = _standardizeLocale(targetLocale);
      if (!_isValidLocale(this.targetLocale, customMapping))
        throw new Error(invalidLocaleError(this.targetLocale));
    }

    // rendering locales
    this._renderingLocales = [];
    if (this.sourceLocale) this._renderingLocales.push(this.sourceLocale);
    if (this.targetLocale) this._renderingLocales.push(this.targetLocale);
    this._renderingLocales.push(libraryDefaultLocale);

    // locales
    if (locales) {
      const result: string[] = [];
      const invalidLocales: string[] = [];
      locales.forEach((locale) => {
        const standardizedLocale = _standardizeLocale(locale);
        if (_isValidLocale(standardizedLocale)) {
          result.push(standardizedLocale);
        } else {
          invalidLocales.push(locale);
        }
      });
      if (invalidLocales.length > 0) {
        throw new Error(invalidLocalesError(invalidLocales));
      }
      this.locales = result;
    }

    // ----- Other properties ----- //
    if (customMapping) {
      this.customMapping = customMapping;
      this.reverseCustomMapping = Object.fromEntries(
        Object.entries(customMapping)
          .filter(
            ([, value]) => value && typeof value === 'object' && 'code' in value
          )
          .map(([key, value]) => [(value as { code: string }).code, key])
      );
    }
  }

  // -------------- Formatting -------------- //

  /**
   * Formats a string with cutoff behavior, applying a terminator when the string exceeds the maximum character limit.
   *
   * This method uses the formatter instance's rendering locales by default for locale-specific terminator selection,
   * but can be overridden with custom locales in the options.
   *
   * @param {string} value - The string value to format with cutoff behavior.
   * @param {Object} [options] - Configuration options for cutoff formatting.
   * @param {string | string[]} [options.locales] - The locales to use for terminator selection. Defaults to instance's rendering locales.
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
   * const gt = new GTFormatter({ targetLocale: 'en-US' });
   * gt.formatCutoff('Hello, world!', { maxChars: 8 });
   * // Returns: 'Hello, w...'
   *
   * @example
   * gt.formatCutoff('Hello, world!', { maxChars: -3 });
   * // Returns: '...ld!'
   */
  formatCutoff(
    value: string,
    options?: {
      locales?: string | string[];
    } & CutoffFormatOptions
  ): string {
    return _formatCutoff({
      value,
      locales: options?.locales || this._renderingLocales,
      options,
    });
  }

  /**
   * Formats a message according to the specified locales and options.
   *
   * @param {string} message - The message to format.
   * @param {string | string[]} [locales='en'] - The locales to use for formatting.
   * @param {FormatVariables} [variables={}] - The variables to use for formatting.
   * @param {StringFormat} [dataFormat='ICU'] - The format of the message.
   * @returns {string} The formatted message.
   *
   * @example
   * gt.formatMessage('Hello {name}', { name: 'John' });
   * // Returns: "Hello John"
   *
   * gt.formatMessage('Hello {name}', { name: 'John' }, { locales: ['fr'] });
   * // Returns: "Bonjour John"
   */
  formatMessage(
    message: string,
    options?: {
      locales?: string | string[];
      variables?: FormatVariables;
      dataFormat?: StringFormat;
    }
  ): string {
    if (options?.dataFormat === 'STRING') return _formatMessageString(message);
    return _formatMessageICU(
      message,
      options?.locales || this._renderingLocales,
      options?.variables
    );
  }

  /**
   * Formats a number according to the specified locales and options.
   *
   * @param {number} number - The number to format
   * @param {Object} [options] - Additional options for number formatting
   * @param {string | string[]} [options.locales] - The locales to use for formatting
   * @param {Intl.NumberFormatOptions} [options] - Additional Intl.NumberFormat options
   * @returns {string} The formatted number
   *
   * @example
   * gt.formatNum(1234.56, { style: 'currency', currency: 'USD' });
   * // Returns: "$1,234.56"
   */
  formatNum(
    number: number,
    options?: {
      locales?: string | string[];
    } & Intl.NumberFormatOptions
  ): string {
    return _formatNum({
      value: number,
      locales: options?.locales || this._renderingLocales,
      options,
    });
  }

  /**
   * Formats a date according to the specified locales and options.
   *
   * @param {Date} date - The date to format
   * @param {Object} [options] - Additional options for date formatting
   * @param {string | string[]} [options.locales] - The locales to use for formatting
   * @param {Intl.DateTimeFormatOptions} [options] - Additional Intl.DateTimeFormat options
   * @returns {string} The formatted date
   *
   * @example
   * gt.formatDateTime(new Date(), { dateStyle: 'full', timeStyle: 'long' });
   * // Returns: "Thursday, March 14, 2024 at 2:30:45 PM GMT-7"
   */
  formatDateTime(
    date: Date,
    options?: {
      locales?: string | string[];
    } & Intl.DateTimeFormatOptions
  ): string {
    return _formatDateTime({
      value: date,
      locales: options?.locales || this._renderingLocales,
      options,
    });
  }

  /**
   * Formats a currency value according to the specified locales and options.
   *
   * @param {number} value - The currency value to format
   * @param {string} currency - The currency code (e.g., 'USD', 'EUR')
   * @param {Object} [options] - Additional options for currency formatting
   * @param {string | string[]} [options.locales] - The locales to use for formatting
   * @param {Intl.NumberFormatOptions} [options] - Additional Intl.NumberFormat options
   * @returns {string} The formatted currency value
   *
   * @example
   * gt.formatCurrency(1234.56, 'USD', { style: 'currency' });
   * // Returns: "$1,234.56"
   */
  formatCurrency(
    value: number,
    currency: string,
    options?: {
      locales?: string | string[];
    } & Intl.NumberFormatOptions
  ): string {
    return _formatCurrency({
      value,
      currency,
      locales: options?.locales || this._renderingLocales,
      options,
    });
  }

  /**
   * Formats a list of items according to the specified locales and options.
   *
   * @param {Array<string | number>} array - The list of items to format
   * @param {Object} [options] - Additional options for list formatting
   * @param {string | string[]} [options.locales] - The locales to use for formatting
   * @param {Intl.ListFormatOptions} [options] - Additional Intl.ListFormat options
   * @returns {string} The formatted list
   *
   * @example
   * gt.formatList(['apple', 'banana', 'orange'], { type: 'conjunction' });
   * // Returns: "apple, banana, and orange"
   */
  formatList(
    array: Array<string | number>,
    options?: {
      locales?: string | string[];
    } & Intl.ListFormatOptions
  ) {
    return _formatList({
      value: array,
      locales: options?.locales || this._renderingLocales,
      options,
    });
  }

  /**
   * Formats a list of items according to the specified locales and options.
   * @param {Array<T>} array - The list of items to format
   * @param {Object} [options] - Additional options for list formatting
   * @param {string | string[]} [options.locales] - The locales to use for formatting
   * @param {Intl.ListFormatOptions} [options] - Additional Intl.ListFormat options
   * @returns {Array<T | string>} The formatted list parts
   *
   * @example
   * gt.formatListToParts(['apple', 42, { foo: 'bar' }], { type: 'conjunction', style: 'short', locales: ['en'] });
   * // Returns: ['apple', ', ', 42, ' and ', '{ foo: "bar" }']
   */
  formatListToParts<T>(
    array: Array<T>,
    options?: {
      locales?: string | string[];
    } & Intl.ListFormatOptions
  ): Array<T | string> {
    return _formatListToParts<T>({
      value: array,
      locales: options?.locales || this._renderingLocales,
      options,
    });
  }

  /**
   * Formats a relative time value according to the specified locales and options.
   *
   * @param {number} value - The relative time value to format
   * @param {Intl.RelativeTimeFormatUnit} unit - The unit of time (e.g., 'second', 'minute', 'hour', 'day', 'week', 'month', 'year')
   * @param {Object} options - Additional options for relative time formatting
   * @param {string | string[]} [options.locales] - The locales to use for formatting
   * @param {Intl.RelativeTimeFormatOptions} [options] - Additional Intl.RelativeTimeFormat options
   * @returns {string} The formatted relative time string
   *
   * @example
   * gt.formatRelativeTime(-1, 'day', { locales: ['en-US'], numeric: 'auto' });
   * // Returns: "yesterday"
   */
  formatRelativeTime(
    value: number,
    unit: Intl.RelativeTimeFormatUnit,
    options?: {
      locales?: string | string[];
    } & Omit<Intl.RelativeTimeFormatOptions, 'locales'>
  ): string {
    return _formatRelativeTime({
      value,
      unit,
      locales: options?.locales || this._renderingLocales,
      options,
    });
  }

  /**
   * Formats a relative time string from a Date, automatically selecting the best unit.
   *
   * @param {Date} date - The date to format relative to now
   * @param {Object} [options] - Additional options for relative time formatting
   * @param {string | string[]} [options.locales] - The locales to use for formatting
   * @returns {string} The formatted relative time string (e.g., "2 hours ago", "in 3 days")
   *
   * @example
   * gt.formatRelativeTimeFromDate(new Date(Date.now() - 3600000));
   * // Returns: "1 hour ago"
   */
  formatRelativeTimeFromDate(
    date: Date,
    options?: {
      locales?: string | string[];
      baseDate?: Date;
    } & Omit<Intl.RelativeTimeFormatOptions, 'locales'>
  ): string {
    const { locales, baseDate, ...intlOptions } = options || {};
    return _formatRelativeTimeFromDate({
      date,
      baseDate: baseDate ?? new Date(),
      locales: locales || this._renderingLocales,
      options: intlOptions,
    });
  }

  // -------------- Locale Properties -------------- //

  /**
   * Retrieves the display name of a locale code using Intl.DisplayNames, returning an empty string if no name is found.
   *
   * @param {string} [locale=this.targetLocale] - A BCP-47 locale code
   * @returns {string} The display name corresponding to the code
   * @throws {Error} If no target locale is provided
   *
   * @example
   * gt.getLocaleName('es-ES');
   * // Returns: "Spanish (Spain)"
   */
  getLocaleName(locale = this.targetLocale): string {
    if (!locale) throw new Error(noTargetLocaleProvidedError('getLocaleName'));
    return _getLocaleName(locale, this.sourceLocale, this.customMapping);
  }

  /**
   * Retrieves an emoji based on a given locale code.
   * Uses the locale's region (if present) to select an emoji or falls back on default emojis.
   *
   * @param {string} [locale=this.targetLocale] - A BCP-47 locale code (e.g., 'en-US', 'fr-CA')
   * @returns {string} The emoji representing the locale or its region
   * @throws {Error} If no target locale is provided
   *
   * @example
   * gt.getLocaleEmoji('es-ES');
   * // Returns: "🇪🇸"
   */
  getLocaleEmoji(locale = this.targetLocale): string {
    if (!locale) throw new Error(noTargetLocaleProvidedError('getLocaleEmoji'));
    return _getLocaleEmoji(locale, this.customMapping);
  }

  /**
   * Generates linguistic details for a given locale code.
   *
   * This function returns information about the locale,
   * script, and region of a given language code both in a standard form and in a maximized form (with likely script and region).
   * The function provides these names in both your default language and native forms, and an associated emoji.
   *
   * @param {string} [locale=this.targetLocale] - The locale code to get properties for (e.g., "de-AT").
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
  getLocaleProperties(locale = this.targetLocale): LocaleProperties {
    if (!locale)
      throw new Error(noTargetLocaleProvidedError('getLocaleProperties'));
    return _getLocaleProperties(locale, this.sourceLocale, this.customMapping);
  }

  /**
   * Retrieves multiple properties for a given region code, including:
   * - `code`: the original region code
   * - `name`: the localized display name
   * - `emoji`: the associated flag or symbol
   *
   * Behavior:
   * - Accepts ISO 3166-1 alpha-2 or UN M.49 region codes (e.g., `"US"`, `"FR"`, `"419"`).
   * - Uses the instance's `targetLocale` to localize the region name for the user.
   * - If `customMapping` contains a `name` or `emoji` for the region, those override the default values.
   * - Otherwise, uses `Intl.DisplayNames` to get the localized region name, falling back to `libraryDefaultLocale`.
   * - Falls back to the region code as `name` if display name resolution fails.
   * - Falls back to a default emoji if no emoji mapping is found in built-in data or `customMapping`.
   *
   * @param {string} [region=this.getLocaleProperties().regionCode] - The region code to look up (e.g., `"US"`, `"GB"`, `"DE"`).
   * @param {CustomRegionMapping} [customMapping] - Optional mapping of region codes to custom names and/or emojis.
   * @returns {{ code: string, name: string, emoji: string }} An object containing:
   *  - `code`: the input region code
   *  - `name`: the localized or custom region name
   *  - `emoji`: the matching emoji flag or symbol
   *
   * @throws {Error} If no target locale is available to determine region properties.
   *
   * @example
   * const gt = new GTFormatter({ targetLocale: 'en-US' });
   * gt.getRegionProperties('US');
   * // => { code: 'US', name: 'United States', emoji: '🇺🇸' }
   *
   * @example
   * const gt = new GTFormatter({ targetLocale: 'fr-FR' });
   * gt.getRegionProperties('US');
   * // => { code: 'US', name: 'États-Unis', emoji: '🇺🇸' }
   *
   * @example
   * gt.getRegionProperties('US', { US: { name: 'USA', emoji: '🗽' } });
   * // => { code: 'US', name: 'USA', emoji: '🗽' }
   */
  getRegionProperties(
    region = this.getLocaleProperties().regionCode,
    customMapping?: CustomRegionMapping
  ): { code: string; name: string; emoji: string } {
    if (!customMapping) {
      if (this.customMapping && !this.customRegionMapping) {
        // Lazy derive custom region mapping from customMapping
        const customRegionMapping: CustomRegionMapping = {};
        for (const [locale, lp] of Object.entries(this.customMapping)) {
          if (
            lp &&
            typeof lp === 'object' &&
            lp.regionCode &&
            !customRegionMapping[lp.regionCode]
          ) {
            const { regionName: name, emoji } = lp;
            customRegionMapping[lp.regionCode] = {
              locale,
              ...(name && { name }),
              ...(emoji && { emoji }),
            };
          }
        }
        this.customRegionMapping = customRegionMapping;
      }
      customMapping = this.customRegionMapping;
    }
    return _getRegionProperties(
      region,
      this.targetLocale, // this.targetLocale because we want it in the user's language
      customMapping
    );
  }

  /**
   * Determines whether a translation is required based on the source and target locales.
   *
   * @param {string} [sourceLocale=this.sourceLocale] - The locale code for the original content
   * @param {string} [targetLocale=this.targetLocale] - The locale code to translate into
   * @param {string[]} [approvedLocales=this.locales] - Optional array of approved target locales
   * @returns {boolean} True if translation is required, false otherwise
   * @throws {Error} If no source locale is provided
   * @throws {Error} If no target locale is provided
   *
   * @example
   * gt.requiresTranslation('en-US', 'es-ES');
   * // Returns: true
   */
  requiresTranslation(
    sourceLocale = this.sourceLocale,
    targetLocale = this.targetLocale,
    approvedLocales: string[] | undefined = this.locales,
    customMapping: CustomMapping | undefined = this.customMapping
  ): boolean {
    if (!sourceLocale)
      throw new Error(noSourceLocaleProvidedError('requiresTranslation'));
    if (!targetLocale)
      throw new Error(noTargetLocaleProvidedError('requiresTranslation'));
    return _requiresTranslation(
      sourceLocale,
      targetLocale,
      approvedLocales,
      customMapping
    );
  }

  /**
   * Determines the best matching locale from the provided approved locales list.
   *
   * @param {string | string[]} locales - A single locale or array of locales in preference order
   * @param {string[]} [approvedLocales=this.locales] - Array of approved locales in preference order
   * @returns {string | undefined} The best matching locale or undefined if no match is found
   *
   * @example
   * gt.determineLocale(['fr-CA', 'fr-FR'], ['en-US', 'fr-FR', 'es-ES']);
   * // Returns: "fr-FR"
   */
  determineLocale(
    locales: string | string[],
    approvedLocales: string[] | undefined = this.locales || [],
    customMapping: CustomMapping | undefined = this.customMapping
  ): string | undefined {
    return _determineLocale(locales, approvedLocales, customMapping);
  }

  /**
   * Gets the text direction for a given locale code.
   *
   * @param {string} [locale=this.targetLocale] - A BCP-47 locale code
   * @returns {'ltr' | 'rtl'} 'rtl' if the locale is right-to-left, otherwise 'ltr'
   * @throws {Error} If no target locale is provided
   *
   * @example
   * gt.getLocaleDirection('ar-SA');
   * // Returns: "rtl"
   */
  getLocaleDirection(locale = this.targetLocale): 'ltr' | 'rtl' {
    if (!locale)
      throw new Error(noTargetLocaleProvidedError('getLocaleDirection'));
    return _getLocaleDirection(locale);
  }

  /**
   * Checks if a given BCP 47 locale code is valid.
   *
   * @param {string} [locale=this.targetLocale] - The BCP 47 locale code to validate
   * @param {CustomMapping} [customMapping=this.customMapping] - The custom mapping to use for validation
   * @returns {boolean} True if the locale code is valid, false otherwise
   * @throws {Error} If no target locale is provided
   *
   * @example
   * gt.isValidLocale('en-US');
   * // Returns: true
   */
  isValidLocale(
    locale = this.targetLocale,
    customMapping: CustomMapping | undefined = this.customMapping
  ): boolean {
    if (!locale) throw new Error(noTargetLocaleProvidedError('isValidLocale'));
    return _isValidLocale(locale, customMapping);
  }

  /**
   * Resolves the canonical locale for a given locale.
   * @param locale - The locale to resolve the canonical locale for
   * @param customMapping - The custom mapping to use for resolving the canonical locale
   * @returns The canonical locale
   */
  resolveCanonicalLocale(
    locale: string | undefined = this.targetLocale,
    customMapping: CustomMapping | undefined = this.customMapping
  ): string {
    if (!locale)
      throw new Error(noTargetLocaleProvidedError('resolveCanonicalLocale'));
    return _resolveCanonicalLocale(locale, customMapping);
  }

  /**
   * Resolves the alias locale for a given locale.
   * @param locale - The locale to resolve the alias locale for
   * @param customMapping - The custom mapping to use for resolving the alias locale
   * @returns The alias locale
   */
  resolveAliasLocale(
    locale: string,
    customMapping: CustomMapping | undefined = this.customMapping
  ): string {
    if (!locale)
      throw new Error(noTargetLocaleProvidedError('resolveAliasLocale'));
    return _resolveAliasLocale(locale, customMapping);
  }

  /**
   * Standardizes a BCP 47 locale code to ensure correct formatting.
   *
   * @param {string} [locale=this.targetLocale] - The BCP 47 locale code to standardize
   * @returns {string} The standardized locale code or empty string if invalid
   * @throws {Error} If no target locale is provided
   *
   * @example
   * gt.standardizeLocale('en_us');
   * // Returns: "en-US"
   */
  standardizeLocale(locale = this.targetLocale): string {
    if (!locale)
      throw new Error(noTargetLocaleProvidedError('standardizeLocale'));
    return _standardizeLocale(locale);
  }

  /**
   * Checks if multiple BCP 47 locale codes represent the same dialect.
   *
   * @param {...(string | string[])} locales - The BCP 47 locale codes to compare
   * @returns {boolean} True if all codes represent the same dialect, false otherwise
   *
   * @example
   * gt.isSameDialect('en-US', 'en-GB');
   * // Returns: false
   *
   * gt.isSameDialect('en', 'en-US');
   * // Returns: true
   */
  isSameDialect(...locales: (string | string[])[]): boolean {
    return _isSameDialect(...locales);
  }

  /**
   * Checks if multiple BCP 47 locale codes represent the same language.
   *
   * @param {...(string | string[])} locales - The BCP 47 locale codes to compare
   * @returns {boolean} True if all codes represent the same language, false otherwise
   *
   * @example
   * gt.isSameLanguage('en-US', 'en-GB');
   * // Returns: true
   */
  isSameLanguage(...locales: (string | string[])[]): boolean {
    return _isSameLanguage(...locales);
  }

  /**
   * Checks if a locale is a superset of another locale.
   *
   * @param {string} superLocale - The locale to check if it is a superset
   * @param {string} subLocale - The locale to check if it is a subset
   * @returns {boolean} True if superLocale is a superset of subLocale, false otherwise
   *
   * @example
   * gt.isSupersetLocale('en', 'en-US');
   * // Returns: true
   *
   * gt.isSupersetLocale('en-US', 'en');
   * // Returns: false
   */
  isSupersetLocale(superLocale: string, subLocale: string): boolean {
    return _isSupersetLocale(superLocale, subLocale);
  }
}

// ============================================================ //
//                    Utility methods                           //
// ============================================================ //

// -------------- Formatting -------------- //

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
): string {
  return _formatCutoff({ value, locales: options?.locales, options });
}

/**
 * Formats a message according to the specified locales and options.
 *
 * @param {string} message - The message to format.
 * @param {string | string[]} [locales='en'] - The locales to use for formatting.
 * @param {FormatVariables} [variables={}] - The variables to use for formatting.
 * @param {StringFormat} [dataFormat='ICU'] - The format of the message. (When STRING, the message is returned as is)
 * @returns {string} The formatted message.
 *
 * @example
 * formatMessage('Hello {name}', { name: 'John' });
 * // Returns: "Hello John"
 *
 * formatMessage('Hello {name}', { name: 'John' }, { locales: ['fr'] });
 * // Returns: "Bonjour John"
 */
export function formatMessage(
  message: string,
  options?: {
    locales?: string | string[];
    variables?: FormatVariables;
    dataFormat?: StringFormat;
  }
): string {
  switch (options?.dataFormat) {
    case 'STRING':
      return _formatMessageString(message);
    default:
      return _formatMessageICU(message, options?.locales, options?.variables);
  }
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
  options: {
    locales: string | string[];
  } & Intl.NumberFormatOptions
): string {
  return _formatNum({
    value: number,
    locales: options.locales,
    options,
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
  options?: {
    locales?: string | string[];
  } & Intl.DateTimeFormatOptions
): string {
  return _formatDateTime({
    value: date,
    locales: options?.locales,
    options,
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
  options: {
    locales: string | string[];
  } & Intl.NumberFormatOptions
): string {
  return _formatCurrency({
    value,
    currency,
    locales: options.locales,
    options,
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
  options: {
    locales: string | string[];
  } & Intl.ListFormatOptions
): string {
  return _formatList({
    value: array,
    locales: options.locales,
    options,
  });
}

/**
 * Formats a list of items according to the specified locales and options.
 * @param {Array<T>} array - The list of items to format
 * @param {Object} [options] - Additional options for list formatting
 * @param {string | string[]} [options.locales] - The locales to use for formatting
 * @param {Intl.ListFormatOptions} [options] - Additional Intl.ListFormat options
 * @returns {Array<T | string>} The formatted list parts
 */
export function formatListToParts<T>(
  array: Array<T>,
  options?: {
    locales?: string | string[];
  } & Intl.ListFormatOptions
): Array<T | string> {
  return _formatListToParts<T>({
    value: array,
    locales: options?.locales,
    options: options,
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
  options: {
    locales: string | string[];
  } & Omit<Intl.RelativeTimeFormatOptions, 'locales'>
): string {
  return _formatRelativeTime({
    value,
    unit,
    locales: options.locales,
    options,
  });
}

/**
 * Formats a relative time string from a Date, automatically selecting the best unit.
 * @param {Date} date - The date to format relative to now.
 * @param {Object} options - Formatting options.
 * @param {string | string[]} options.locales - The locales to use for formatting.
 * @param {Intl.RelativeTimeFormatOptions} [options] - Additional Intl.RelativeTimeFormat options.
 * @returns {string} The formatted relative time string (e.g., "2 hours ago", "in 3 days").
 */
export function formatRelativeTimeFromDate(
  date: Date,
  options: {
    locales: string | string[];
    baseDate?: Date;
  } & Omit<Intl.RelativeTimeFormatOptions, 'locales'>
): string {
  const { locales, baseDate, ...intlOptions } = options;
  return _formatRelativeTimeFromDate({
    date,
    baseDate: baseDate ?? new Date(),
    locales,
    options: intlOptions,
  });
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
 * Retrieves multiple properties for a given region code, including:
 * - `code`: the original region code
 * - `name`: the localized display name
 * - `emoji`: the associated flag or symbol
 *
 * Behavior:
 * - Accepts ISO 3166-1 alpha-2 or UN M.49 region codes (e.g., `"US"`, `"FR"`, `"419"`).
 * - If `customMapping` contains a `name` or `emoji` for the region, those override the default values.
 * - Otherwise, uses `Intl.DisplayNames` to get the localized region name in the given `defaultLocale`,
 *   falling back to `libraryDefaultLocale`.
 * - Falls back to the region code as `name` if display name resolution fails.
 * - Falls back to `defaultEmoji` if no emoji mapping is found in `emojis` or `customMapping`.
 *
 * @param {string} region - The region code to look up (e.g., `"US"`, `"GB"`, `"DE"`).
 * @param {string} [defaultLocale=libraryDefaultLocale] - The locale to use when localizing the region name.
 * @param {CustomRegionMapping} [customMapping] - Optional mapping of region codes to custom names and/or emojis.
 * @returns {{ code: string, name: string, emoji: string }} An object containing:
 *  - `code`: the input region code
 *  - `name`: the localized or custom region name
 *  - `emoji`: the matching emoji flag or symbol
 *
 * @example
 * getRegionProperties('US', 'en');
 * // => { code: 'US', name: 'United States', emoji: '🇺🇸' }
 *
 * @example
 * getRegionProperties('US', 'fr');
 * // => { code: 'US', name: 'États-Unis', emoji: '🇺🇸' }
 *
 * @example
 * getRegionProperties('US', 'en', { US: { name: 'USA', emoji: '🗽' } });
 * // => { code: 'US', name: 'USA', emoji: '🗽' }
 */
export function getRegionProperties(
  region: string,
  defaultLocale?: string,
  customMapping?: CustomRegionMapping
): { code: string; name: string; emoji: string } {
  return _getRegionProperties(region, defaultLocale, customMapping);
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
 * @returns {string} - 'rtl' if the locale is right-to-left, otherwise 'ltr'.
 */
export function getLocaleDirection(locale: string): 'ltr' | 'rtl' {
  return _getLocaleDirection(locale);
}

/**
 * Checks if a given BCP 47 locale code is valid.
 * @param {string} locale - The BCP 47 locale code to validate.
 * @param {CustomMapping} [customMapping] - The custom mapping to use for validation.
 * @returns {boolean} True if the BCP 47 code is valid, false otherwise.
 */
export function isValidLocale(
  locale: string,
  customMapping?: CustomMapping
): boolean {
  return _isValidLocale(locale, customMapping);
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
 * Resolves the canonical locale for a given locale.
 * @param {string} locale - The locale to resolve the canonical locale for
 * @param {CustomMapping} [customMapping] - The custom mapping to use for resolving the canonical locale
 * @returns {string} The canonical locale
 */
export function resolveCanonicalLocale(
  locale: string,
  customMapping?: CustomMapping
): string {
  return _resolveCanonicalLocale(locale, customMapping);
}

/**
 * Standardizes a BCP 47 locale code to ensure correct formatting.
 * @param {string} locale - The BCP 47 locale code to standardize.
 * @returns {string} The standardized BCP 47 locale code or an empty string if it is an invalid code.
 */
export function standardizeLocale(locale: string): string {
  return _standardizeLocale(locale);
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
