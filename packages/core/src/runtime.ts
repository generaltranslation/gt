// `generaltranslation` language toolkit
// © 2026, General Translation, Inc.

// ----- IMPORTS ----- //

import {
  LocaleConfig,
  determineLocale as _determineLocale,
  getRegionProperties as _getRegionProperties,
  isValidLocale as _isValidLocale,
  requiresTranslation as _requiresTranslation,
  resolveAliasLocale as _resolveAliasLocale,
  resolveCanonicalLocale as _resolveCanonicalLocale,
  standardizeLocale as _standardizeLocale,
} from '@generaltranslation/format';
import type {
  CustomMapping,
  CustomRegionMapping,
  CutoffFormatOptions,
  FormatVariables,
  LocaleProperties,
  StringFormat,
} from '@generaltranslation/format/types';
import {
  TranslateManyResult,
  TranslationError,
  TranslationRequestConfig,
  TranslationResult,
  TranslateManyEntry,
} from './types';
import { libraryDefaultLocale } from './settings/settings';
import {
  noSourceLocaleProvidedError,
  noTargetLocaleProvidedError,
  invalidLocaleError,
  invalidLocalesError,
  noProjectIdProvidedError,
  noApiKeyProvidedError,
} from './logging/errors';
import { gtInstanceLogger } from './logging/logger';
import { _translateMany } from './translate/translateMany';
import { TranslateOptions } from './types-dir/api/entry';

// ============================================================ //
//                       Runtime Class                          //
// ============================================================ //
/**
 * Type representing the constructor parameters for the GT and GTRuntime classes.
 * @typedef {Object} GTConstructorParams
 * @property {string} [apiKey] - The API key for accessing the translation service
 * @property {string} [devApiKey] - The development API key for accessing the translation service
 * @property {string} [sourceLocale] - The default source locale for translations
 * @property {string} [targetLocale] - The default target locale for translations
 * @property {string[]} [locales] - Array of supported locales
 * @property {string} [projectId] - The project ID for the translation service
 * @property {string} [baseUrl] - The base URL for the translation service
 * @property {CustomMapping} [customMapping] - Custom mapping of locale codes to their names
 */
export type GTConstructorParams = {
  apiKey?: string;
  devApiKey?: string;
  sourceLocale?: string;
  targetLocale?: string;
  locales?: string[];
  projectId?: string;
  baseUrl?: string;
  customMapping?: CustomMapping;
};

/**
 * GTRuntime is the runtime core of the GT driver: locale management,
 * formatting, and runtime translation requests.
 *
 * Browser-facing SDK code constructs this class (via `generaltranslation/runtime`)
 * so production bundles do not ship the project/file management API client
 * that lives on the GT class exported from the main entry.
 *
 * @example
 * const gt = new GTRuntime({
 *   sourceLocale: 'en-US',
 *   targetLocale: 'es-ES',
 *   locales: ['en-US', 'es-ES', 'fr-FR']
 * });
 */
export class GTRuntime {
  /** Base URL for the translation service API */
  baseUrl?: string;

  /** Project ID for the translation service */
  projectId?: string;

  /** API key for accessing the translation service */
  apiKey?: string;

  /** Development API key for accessing the translation service */
  devApiKey?: string;

  /** Source locale for translations */
  sourceLocale?: string;

  /** Target locale for translations */
  targetLocale?: string;

  /** Array of supported locales */
  locales?: string[];

  /** Custom mapping for locale codes to their names */
  customMapping?: CustomMapping;

  /** Lazily derived reverse custom mapping for alias locales */
  reverseCustomMapping?: Record<string, string>;

  /** Lazily derived custom mapping for regions */
  customRegionMapping?: CustomRegionMapping;

  /** Runtime-safe locale and formatting helpers (backing field) */
  private _localeConfig!: LocaleConfig;

  /** Runtime-safe locale and formatting helpers */
  get localeConfig() {
    return this._localeConfig;
  }

  /**
   * Constructs an instance of the GTRuntime class.
   *
   * @param {GTConstructorParams} [params] - The parameters for initializing the GTRuntime instance
   * @throws {Error} If an invalid locale is provided
   * @throws {Error} If any of the provided locales are invalid
   *
   * @example
   * const gt = new GTRuntime({
   *   apiKey: 'your-api-key',
   *   sourceLocale: 'en-US',
   *   targetLocale: 'es-ES',
   *   locales: ['en-US', 'es-ES', 'fr-FR']
   * });
   */
  constructor(params: GTConstructorParams = {}) {
    // Read environment
    if (typeof process !== 'undefined') {
      this.apiKey ||= process.env?.GT_API_KEY;
      this.devApiKey ||= process.env?.GT_DEV_API_KEY;
      this.projectId ||= process.env?.GT_PROJECT_ID;
    }
    // Set up config
    this.setConfig(params);
  }

  setConfig({
    apiKey,
    devApiKey,
    sourceLocale,
    targetLocale,
    locales,
    projectId,
    customMapping,
    baseUrl,
  }: GTConstructorParams) {
    // ----- Environment properties ----- //
    if (apiKey) this.apiKey = apiKey;
    if (devApiKey) this.devApiKey = devApiKey;
    if (projectId) this.projectId = projectId;

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
    if (baseUrl) this.baseUrl = baseUrl;
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
    this._localeConfig = new LocaleConfig({
      defaultLocale: this.sourceLocale,
      locales: this.locales ?? [],
      customMapping: this.customMapping,
    });
  }

  // -------------- Private Methods -------------- //

  protected _getTranslationConfig(): TranslationRequestConfig {
    return {
      baseUrl: this.baseUrl,
      apiKey: this.apiKey || this.devApiKey,
      projectId: this.projectId || '',
    };
  }

  protected _validateAuth(functionName: string) {
    const errors: string[] = [];
    if (!this.apiKey && !this.devApiKey) {
      const error = noApiKeyProvidedError(functionName);
      errors.push(error);
    }
    if (!this.projectId) {
      const error = noProjectIdProvidedError(functionName);
      errors.push(error);
    }
    if (errors.length) {
      throw new Error(errors.join('\n'));
    }
  }

  /**
   * Translates a single source string to the target locale.
   * Routes through {@link translateMany} under the hood.
   *
   * @param {string} source - The source string to translate.
   * @param {object} options - Translation options including targetLocale and optional entry metadata.
   * @returns {Promise<TranslationResult | TranslationError>} The translated content.
   *
   * @example
   * const result = await gt.translate('Hello, world!', { targetLocale: 'es' });
   *
   * @example
   * const result = await gt.translate('Hello, world!', {
   *   targetLocale: 'es',
   *   dataFormat: 'ICU',
   *   context: 'A formal greeting',
   * });
   */
  async translate(
    source: TranslateManyEntry,
    options: string | TranslateOptions,
    timeout?: number
  ): Promise<TranslationResult | TranslationError> {
    // Normalize string shorthand to options object
    if (typeof options === 'string') {
      options = { targetLocale: options };
    }

    // Validation
    this._validateAuth('translate');

    // Require target locale
    let targetLocale = options?.targetLocale || this.targetLocale;
    if (!targetLocale) {
      const error = noTargetLocaleProvidedError('translate');
      gtInstanceLogger.error(error);
      throw new Error(error);
    }

    // Replace target locale with canonical locale
    targetLocale = this.resolveCanonicalLocale(targetLocale);

    const sourceLocale = this.resolveCanonicalLocale(
      options?.sourceLocale || this.sourceLocale || libraryDefaultLocale
    );

    // Request the translation.
    const results = await _translateMany(
      [source],
      {
        ...options,
        targetLocale,
        sourceLocale,
      },
      this._getTranslationConfig(),
      timeout
    );
    return results[0];
  }

  /**
   * Translates multiple source strings to the target locale.
   * Each entry can be a plain string or an object with source and metadata fields.
   *
   * @param {TranslateManyEntry[] | Record<string, TranslateManyEntry>} sources - The source entries to translate. Can be an array or a record keyed by hash.
   * @param {object} options - Translation options including targetLocale.
   * @returns {Promise<TranslateManyResult | Record<string, TranslationResult>>} The translated contents. An array if sources was an array, a record if sources was a record.
   *
   * @example
   * const result = await gt.translateMany(
   *   ['Hello, world!', 'Goodbye, world!'],
   *   { targetLocale: 'es' }
   * );
   *
   * @example
   * const result = await gt.translateMany(
   *   [{ source: 'Hello, world!', dataFormat: 'ICU' }],
   *   { targetLocale: 'es' }
   * );
   *
   * @example
   * const result = await gt.translateMany(
   *   { 'my-hash': 'Hello, world!' },
   *   { targetLocale: 'es' }
   * );
   */
  async translateMany(
    sources: TranslateManyEntry[],
    options: string | TranslateOptions,
    timeout?: number
  ): Promise<TranslateManyResult>;
  async translateMany(
    sources: Record<string, TranslateManyEntry>,
    options: string | TranslateOptions,
    timeout?: number
  ): Promise<Record<string, TranslationResult>>;
  async translateMany(
    sources: TranslateManyEntry[] | Record<string, TranslateManyEntry>,
    options: string | TranslateOptions,
    timeout?: number
  ): Promise<TranslateManyResult | Record<string, TranslationResult>> {
    // Normalize string shorthand to options object
    if (typeof options === 'string') {
      options = { targetLocale: options };
    }

    // Validation
    this._validateAuth('translateMany');

    // Require target locale
    let targetLocale = options?.targetLocale || this.targetLocale;
    if (!targetLocale) {
      const error = noTargetLocaleProvidedError('translateMany');
      gtInstanceLogger.error(error);
      throw new Error(error);
    }

    // Replace target locale with canonical locale
    targetLocale = this.resolveCanonicalLocale(targetLocale);

    const sourceLocale = this.resolveCanonicalLocale(
      options?.sourceLocale || this.sourceLocale || libraryDefaultLocale
    );

    // Request the translation.
    return await _translateMany(
      sources,
      {
        ...options,
        targetLocale,
        sourceLocale,
      },
      this._getTranslationConfig(),
      timeout
    );
  }

  // -------------- Formatting -------------- //

  /**
   * Formats a string with cutoff behavior, applying a terminator when the string exceeds the maximum character limit.
   *
   * This method uses the GT instance's rendering locales by default for locale-specific terminator selection,
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
   * const gt = new GTRuntime({ targetLocale: 'en-US' });
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
    return this.localeConfig.formatCutoff(value, this.targetLocale, options);
  }

  /**
   * Formats a message according to the specified locales and options.
   *
   * @param {string} message - The message to format.
   * @param {string | string[]} [locales=libraryDefaultLocale] - The locales to use for formatting.
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
    return this.localeConfig.formatMessage(message, this.targetLocale, options);
  }
  /**
   * Formats a number according to the specified locales and options.
   *
   * @param {number} number - The number to format.
   * @param {Object} [options] - Additional options for number formatting.
   * @param {string | string[]} [options.locales] - The locales to use for formatting.
   * @param {Intl.NumberFormatOptions} [options] - Additional Intl.NumberFormat options.
   * @returns {string} The formatted number.
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
    return this.localeConfig.formatNum(number, this.targetLocale, options);
  }

  /**
   * Formats a date according to the specified locales and options.
   *
   * @param {Date} date - The date to format.
   * @param {Object} [options] - Additional options for date formatting.
   * @param {string | string[]} [options.locales] - The locales to use for formatting.
   * @param {Intl.DateTimeFormatOptions} [options] - Additional Intl.DateTimeFormat options.
   * @returns {string} The formatted date.
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
    return this.localeConfig.formatDateTime(date, this.targetLocale, options);
  }

  /**
   * Formats a currency value according to the specified locales and options.
   *
   * @param {number} value - The currency value to format.
   * @param {string} currency - The currency code (e.g., 'USD', 'EUR')
   * @param {Object} [options] - Additional options for currency formatting.
   * @param {string | string[]} [options.locales] - The locales to use for formatting.
   * @param {Intl.NumberFormatOptions} [options] - Additional Intl.NumberFormat options.
   * @returns {string} The formatted currency value.
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
    return this.localeConfig.formatCurrency(
      value,
      currency,
      this.targetLocale,
      options
    );
  }

  /**
   * Formats a list of items according to the specified locales and options.
   *
   * @param {Array<string | number>} array - The list of items to format.
   * @param {Object} [options] - Additional options for list formatting.
   * @param {string | string[]} [options.locales] - The locales to use for formatting.
   * @param {Intl.ListFormatOptions} [options] - Additional Intl.ListFormat options.
   * @returns {string} The formatted list.
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
    return this.localeConfig.formatList(array, this.targetLocale, options);
  }

  /**
   * Formats a list of items according to the specified locales and options.
   * @param {Array<T>} array - The list of items to format.
   * @param {Object} [options] - Additional options for list formatting.
   * @param {string | string[]} [options.locales] - The locales to use for formatting.
   * @param {Intl.ListFormatOptions} [options] - Additional Intl.ListFormat options.
   * @returns {Array<T | string>} The formatted list parts.
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
    return this.localeConfig.formatListToParts<T>(
      array,
      this.targetLocale,
      options
    );
  }

  /**
   * Formats a relative time value according to the specified locales and options.
   *
   * @param {number} value - The relative time value to format.
   * @param {Intl.RelativeTimeFormatUnit} unit - The unit of time (e.g., 'second', 'minute', 'hour', 'day', 'week', 'month', 'year')
   * @param {Object} options - Additional options for relative time formatting.
   * @param {string | string[]} [options.locales] - The locales to use for formatting.
   * @param {Intl.RelativeTimeFormatOptions} [options] - Additional Intl.RelativeTimeFormat options.
   * @returns {string} The formatted relative time string.
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
    return this.localeConfig.formatRelativeTime(
      value,
      unit,
      this.targetLocale,
      options
    );
  }

  /**
   * Formats a relative time string from a Date, automatically selecting the best unit.
   *
   * @param {Date} date - The date to format relative to now.
   * @param {Object} [options] - Additional options for relative time formatting.
   * @param {string | string[]} [options.locales] - The locales to use for formatting.
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
    return this.localeConfig.formatRelativeTimeFromDate(
      date,
      this.targetLocale,
      options
    );
  }

  // -------------- Locale Properties -------------- //

  /**
   * Retrieves the display name of a locale code using Intl.DisplayNames, returning an empty string if no name is found.
   *
   * @param {string} [locale=this.targetLocale] - A BCP-47 locale code.
   * @returns {string} The display name corresponding to the code.
   * @throws {Error} If no target locale is provided.
   *
   * @example
   * gt.getLocaleName('es-ES');
   * // Returns: "Spanish (Spain)"
   */
  getLocaleName(locale = this.targetLocale): string {
    if (!locale) throw new Error(noTargetLocaleProvidedError('getLocaleName'));
    return this.localeConfig.getLocaleName(locale);
  }

  /**
   * Retrieves an emoji based on a given locale code.
   * Uses the locale's region (if present) to select an emoji or falls back on default emojis.
   *
   * @param {string} [locale=this.targetLocale] - A BCP-47 locale code (e.g., 'en-US', 'fr-CA')
   * @returns {string} The emoji representing the locale or its region.
   * @throws {Error} If no target locale is provided.
   *
   * @example
   * gt.getLocaleEmoji('es-ES');
   * // Returns: "🇪🇸"
   */
  getLocaleEmoji(locale = this.targetLocale): string {
    if (!locale) throw new Error(noTargetLocaleProvidedError('getLocaleEmoji'));
    return this.localeConfig.getLocaleEmoji(locale);
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
    return this.localeConfig.getLocaleProperties(locale);
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
   * const gt = new GTRuntime({ targetLocale: 'en-US' });
   * gt.getRegionProperties('US');
   * // => { code: 'US', name: 'United States', emoji: '🇺🇸' }
   *
   * @example
   * const gt = new GTRuntime({ targetLocale: 'fr-FR' });
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
   * @param {string} [sourceLocale=this.sourceLocale] - The locale code for the original content.
   * @param {string} [targetLocale=this.targetLocale] - The locale code to translate into.
   * @param {string[]} [approvedLocales=this.locales] - Optional array of approved target locales.
   * @returns {boolean} True if translation is required, false otherwise
   * @throws {Error} If no source locale is provided.
   * @throws {Error} If no target locale is provided.
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
    if (customMapping === this.customMapping) {
      return this.localeConfig.requiresTranslation(
        targetLocale,
        sourceLocale,
        approvedLocales
      );
    }
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
   * @param {string | string[]} locales - A single locale or array of locales in preference order.
   * @param {string[]} [approvedLocales=this.locales] - Array of approved locales in preference order.
   * @returns {string | undefined} The best matching locale, or undefined if no match is found.
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
    if (customMapping === this.customMapping) {
      return this.localeConfig.determineLocale(locales, approvedLocales ?? []);
    }
    return _determineLocale(locales, approvedLocales, customMapping);
  }

  /**
   * Gets the text direction for a given locale code.
   *
   * @param {string} [locale=this.targetLocale] - A BCP-47 locale code.
   * @returns {'ltr' | 'rtl'} 'rtl' if the locale is right-to-left; otherwise 'ltr'.
   * @throws {Error} If no target locale is provided.
   *
   * @example
   * gt.getLocaleDirection('ar-SA');
   * // Returns: "rtl"
   */
  getLocaleDirection(locale = this.targetLocale): 'ltr' | 'rtl' {
    if (!locale)
      throw new Error(noTargetLocaleProvidedError('getLocaleDirection'));
    return this.localeConfig.getLocaleDirection(locale);
  }

  /**
   * Checks if a given BCP 47 locale code is valid.
   *
   * @param {string} [locale=this.targetLocale] - The BCP 47 locale code to validate.
   * @param {CustomMapping} [customMapping=this.customMapping] - The custom mapping to use for validation.
   * @returns {boolean} True if the locale code is valid, false otherwise
   * @throws {Error} If no target locale is provided.
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
    if (customMapping === this.customMapping) {
      return this.localeConfig.isValidLocale(locale);
    }
    return _isValidLocale(locale, customMapping);
  }

  /**
   * Resolves the canonical locale for a given locale.
   * @param locale - The locale to resolve the canonical locale for
   * @param customMapping - The custom mapping to use for resolving the canonical locale
   * @returns The canonical locale, or the input locale when no canonical mapping exists.
   */
  resolveCanonicalLocale(
    locale: string | undefined = this.targetLocale,
    customMapping: CustomMapping | undefined = this.customMapping
  ): string {
    if (!locale)
      throw new Error(noTargetLocaleProvidedError('resolveCanonicalLocale'));
    if (customMapping === this.customMapping) {
      return this.localeConfig.resolveCanonicalLocale(locale);
    }
    return _resolveCanonicalLocale(locale, customMapping);
  }

  /**
   * Resolves the alias locale for a given locale.
   * @param locale - The locale to resolve the alias locale for
   * @param customMapping - The custom mapping to use for resolving the alias locale
   * @returns The configured alias for a canonical locale, or the input locale when already an alias or no alias mapping exists.
   */
  resolveAliasLocale(
    locale: string,
    customMapping: CustomMapping | undefined = this.customMapping
  ): string {
    if (!locale)
      throw new Error(noTargetLocaleProvidedError('resolveAliasLocale'));
    if (customMapping === this.customMapping) {
      return this.localeConfig.resolveAliasLocale(locale);
    }
    return _resolveAliasLocale(locale, customMapping);
  }

  /**
   * Standardizes a BCP 47 locale code to ensure correct formatting.
   *
   * @param {string} [locale=this.targetLocale] - The BCP 47 locale code to standardize.
   * @returns {string} The standardized locale code, or the input string if it cannot be standardized.
   * @throws {Error} If no target locale is provided.
   *
   * @example
   * gt.standardizeLocale('en_us');
   * // Returns: "en-US"
   */
  standardizeLocale(locale = this.targetLocale): string {
    if (!locale)
      throw new Error(noTargetLocaleProvidedError('standardizeLocale'));
    return this.localeConfig.standardizeLocale(locale);
  }

  /**
   * Checks if multiple BCP 47 locale codes represent the same dialect.
   *
   * @param {...(string | string[])} locales - The BCP 47 locale codes to compare.
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
    return this.localeConfig.isSameDialect(...locales);
  }

  /**
   * Checks if multiple BCP 47 locale codes represent the same language.
   *
   * @param {...(string | string[])} locales - The BCP 47 locale codes to compare.
   * @returns {boolean} True if all codes represent the same language, false otherwise
   *
   * @example
   * gt.isSameLanguage('en-US', 'en-GB');
   * // Returns: true
   */
  isSameLanguage(...locales: (string | string[])[]): boolean {
    return this.localeConfig.isSameLanguage(...locales);
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
    return this.localeConfig.isSupersetLocale(superLocale, subLocale);
  }
}
