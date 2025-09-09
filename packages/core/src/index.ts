// `generaltranslation` language toolkit
// © 2024, General Translation, Inc.

// ----- IMPORTS ----- //

import _requiresTranslation from './locales/requiresTranslation';
import _determineLocale from './locales/determineLocale';
import {
  _formatNum,
  _formatCurrency,
  _formatList,
  _formatRelativeTime,
  _formatDateTime,
  _formatMessage,
} from './formatting/format';
import {
  Content,
  CustomMapping,
  FormatVariables,
  I18nextMessage,
  IcuMessage,
  TranslateManyResult,
  TranslationError,
  TranslationRequestConfig,
  TranslationResult,
  Updates,
  EnqueueEntriesOptions,
  EnqueueEntriesResult,
  EnqueueFilesOptions,
  EnqueueFilesResult,
  FileToTranslate,
  CheckFileTranslationsOptions,
  CheckFileTranslationsResult,
  DownloadFileBatchOptions,
  DownloadFileBatchResult,
  FetchTranslationsOptions,
  FetchTranslationsResult,
  DownloadFileOptions,
  EntryMetadata,
  Entry,
} from './types';
import _isSameLanguage from './locales/isSameLanguage';
import _getLocaleProperties, {
  LocaleProperties,
} from './locales/getLocaleProperties';
import _getLocaleEmoji from './locales/getLocaleEmoji';
import { _isValidLocale, _standardizeLocale } from './locales/isValidLocale';
import { _getLocaleName } from './locales/getLocaleName';
import { _getLocaleDirection } from './locales/getLocaleDirection';
import { JsxChildren, libraryDefaultLocale } from './internal';
import _isSameDialect from './locales/isSameDialect';
import _isSupersetLocale from './locales/isSupersetLocale';
import {
  noSourceLocaleProvidedError,
  noTargetLocaleProvidedError,
  invalidLocaleError,
  invalidLocalesError,
  noProjectIdProvidedError,
  noApiKeyProvidedError,
  invalidAuthError,
} from './logging/errors';
import _translate from './translate/translate';
import { gtInstanceLogger } from './logging/logger';
import _translateMany from './translate/translateMany';
import _enqueueFiles from './translate/enqueueFiles';
import _enqueueEntries from './translate/enqueueEntries';
import _checkFileTranslations from './translate/checkFileTranslations';
import _downloadFile from './translate/downloadFile';
import _downloadFileBatch from './translate/downloadFileBatch';
import _fetchTranslations from './translate/fetchTranslations';
import { FileTranslationQuery } from './types-dir/checkFileTranslations';
import { RequiredEnqueueFilesOptions } from './types-dir/enqueueFiles';
import {
  CheckTranslationStatusOptions,
  TranslationStatusResult,
} from './types-dir/translationStatus';
import _checkTranslationStatus from './translate/checkTranslationStatus';
import {
  _getRegionProperties,
  CustomRegionMapping,
} from './locales/getRegionProperties';

// ============================================================ //
//                        Core Class                            //
// ============================================================ //
/**
 * Type representing the constructor parameters for the GT class.
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
type GTConstructorParams = {
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
 * GT is the core driver for the General Translation library.
 * This class provides functionality for locale management, formatting, and translation operations.
 *
 * @class GT
 * @description A comprehensive toolkit for handling internationalization and localization.
 *
 * @example
 * const gt = new GT({
 *   sourceLocale: 'en-US',
 *   targetLocale: 'es-ES',
 *   locales: ['en-US', 'es-ES', 'fr-FR']
 * });
 */
export class GT {
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

  /** Array of locales used for rendering variables */
  _renderingLocales: string[] = [];

  /** Custom mapping for locale codes to their names */
  customMapping?: CustomMapping;

  /** Lazily derived custom mapping for regions */
  customRegionMapping?: CustomRegionMapping;

  /**
   * Constructs an instance of the GT class.
   *
   * @param {GTConstructorParams} [params] - The parameters for initializing the GT instance
   * @throws {Error} If an invalid locale is provided
   * @throws {Error} If any of the provided locales are invalid
   *
   * @example
   * const gt = new GT({
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
      if (!_isValidLocale(this.sourceLocale))
        throw new Error(invalidLocaleError(this.sourceLocale));
    }

    // target locale
    if (targetLocale) {
      this.targetLocale = _standardizeLocale(targetLocale);
      if (!_isValidLocale(this.targetLocale))
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
    if (baseUrl) this.baseUrl = baseUrl;
    if (customMapping) this.customMapping = customMapping;
  }

  // -------------- Private Methods -------------- //

  private _getTranslationConfig(): TranslationRequestConfig {
    return {
      baseUrl: this.baseUrl,
      apiKey: this.apiKey || this.devApiKey,
      projectId: this.projectId || '',
    };
  }

  private _validateAuth(functionName: string) {
    const errors: string[] = [];
    if (!this.apiKey && !this.devApiKey) {
      const error = noApiKeyProvidedError(functionName);
      gtInstanceLogger.error(error);
      errors.push(error);
    }
    if (!this.projectId) {
      const error = noProjectIdProvidedError(functionName);
      gtInstanceLogger.error(error);
      errors.push(error);
    }
    if (errors.length) {
      throw new Error(errors.join('\n'));
    }
  }

  // -------------- Translation Methods -------------- //

  /**
   * Enqueues translation entries for processing.
   *
   * @param {Updates} updates - The translation entries to enqueue.
   * @param {EnqueueEntriesOptions} options - Options for enqueueing entries.
   * @param {string} library - The library being used (for context).
   * @returns {Promise<EnqueueTranslationEntriesResult>} The result of the enqueue operation.
   *
   * @example
   * @deprecated Use the {@link enqueueFiles} method instead. Will be removed in v8.0.0.
   * const gt = new GT({
   *   sourceLocale: 'en-US',
   *   targetLocale: 'es-ES',
   *   locales: ['en-US', 'es-ES', 'fr-FR']
   * });
   *
   * const result = await gt.enqueueEntries([
   *   {
   *     content: 'Hello, world!',
   *     fileName: 'Button.tsx',
   *     fileFormat: 'TS',
   *     dataFormat: 'JSX',
   *   },
   * ], {
   *   sourceLocale: 'en-US',
   *   targetLocales: ['es-ES', 'fr-FR'],
   *   publish: true,
   *   description: 'Translations for the Button component',
   * });
   */
  async enqueueEntries(
    updates: Updates,
    options: EnqueueEntriesOptions = {}
  ): Promise<EnqueueEntriesResult> {
    // Validation
    this._validateAuth('enqueueTranslationEntries');

    // Merge instance settings with options
    const mergedOptions: EnqueueEntriesOptions = {
      ...options,
      sourceLocale: options.sourceLocale ?? this.sourceLocale,
    };

    // Request the translation entry updates
    return await _enqueueEntries(
      updates,
      mergedOptions,
      this._getTranslationConfig()
    );
  }

  /**
   * Enqueues files for translation processing.
   *
   * @param {FileToTranslate[]} files - Array of files to enqueue for translation.
   * @param {EnqueueFilesOptions} options - Options for enqueueing files.
   * @returns {Promise<EnqueueFilesResult>} The result of the enqueue operation.
   *
   * @example
   * const gt = new GT({
   *   sourceLocale: 'en-US',
   *   targetLocale: 'es-ES',
   *   locales: ['en-US', 'es-ES', 'fr-FR']
   * });
   *
   * const result = await gt.enqueueFiles([
   *   {
   *     content: 'Hello, world!',
   *     fileName: 'Button.tsx',
   *     fileFormat: 'TS',
   *     dataFormat: 'JSX',
   *   },
   * ], {
   *   sourceLocale: 'en-US',
   *   targetLocales: ['es-ES', 'fr-FR'],
   *   publish: true,
   *   description: 'Translations for the Button component',
   * });
   */
  async enqueueFiles(
    files: FileToTranslate[],
    options: EnqueueFilesOptions
  ): Promise<EnqueueFilesResult> {
    // Validation
    this._validateAuth('enqueueFiles');

    // Merge instance settings with options
    const mergedOptions: EnqueueFilesOptions = {
      ...options,
      sourceLocale: options.sourceLocale ?? this.sourceLocale,
    };

    // Require source locale
    if (!mergedOptions.sourceLocale) {
      const error = noSourceLocaleProvidedError('enqueueFiles');
      gtInstanceLogger.error(error);
      throw new Error(error);
    }

    // Request the file updates
    return await _enqueueFiles(
      files,
      mergedOptions as RequiredEnqueueFilesOptions,
      this._getTranslationConfig()
    );
  }

  /**
   * Checks the translation status of files.
   *
   * @param {Object} data - Object mapping source paths to file information.
   * @param {CheckFileTranslationsOptions} options - Options for checking file translations.
   * @returns {Promise<CheckFileTranslationsResult>} The file translation status information.
   *
   * @example
   * const gt = new GT({
   *   sourceLocale: 'en-US',
   *   targetLocale: 'es-ES',
   *   locales: ['en-US', 'es-ES', 'fr-FR']
   * });
   *
   * const result = await gt.checkFileTranslations([
   *   { sourcePath: 'src/components/Button.tsx', locale: 'es-ES' },
   *   { sourcePath: 'src/components/Input.tsx', locale: 'fr-FR' },
   * ], {
   *   timeout: 10000,
   * });
   *
   */
  async checkFileTranslations(
    data: FileTranslationQuery[],
    options: CheckFileTranslationsOptions = {}
  ): Promise<CheckFileTranslationsResult> {
    // Validation
    this._validateAuth('checkFileTranslations');

    // Request the file translation status
    return await _checkFileTranslations(
      data,
      options,
      this._getTranslationConfig()
    );
  }

  /**
   * Checks the translation status of a version.
   *
   * @param {string} versionId - The ID of the version to check.
   * @param {CheckTranslationStatusOptions} options - Options for checking the translation status.
   * @returns {Promise<TranslationStatusResult>} The translation status of the version.
   *
   * @example
   * const gt = new GT({
   *   sourceLocale: 'en-US',
   *   targetLocale: 'es-ES',
   *   locales: ['en-US', 'es-ES', 'fr-FR']
   * });
   *
   * const result = await gt.checkTranslationStatus('1234567890', {
   *   timeout: 10000,
   * });
   */
  async checkTranslationStatus(
    versionId: string,
    options: CheckTranslationStatusOptions = {}
  ): Promise<TranslationStatusResult> {
    // Validation
    this._validateAuth('checkTranslationStatus');

    // Request the translation status
    return await _checkTranslationStatus(
      versionId,
      options,
      this._getTranslationConfig()
    );
  }

  /**
   * Downloads a single translation file.
   *
   * @param {string} translationId - The ID of the translation to download.
   * @param {DownloadFileOptions} options - Options for downloading the file.
   * @returns {Promise<DownloadFileResult>} The downloaded file content and metadata.
   *
   * @example
   * const gt = new GT({
   *   sourceLocale: 'en-US',
   *   targetLocale: 'es-ES',
   *   locales: ['en-US', 'es-ES', 'fr-FR']
   * });
   *
   * const result = await gt.downloadFile('1234567890', {
   *   timeout: 10000,
   * });
   */
  async downloadFile(
    translationId: string,
    options: DownloadFileOptions = {}
  ): Promise<ArrayBuffer> {
    // Validation
    this._validateAuth('downloadFile');

    return await _downloadFile(
      translationId,
      options,
      this._getTranslationConfig()
    );
  }

  /**
   * Downloads multiple translation files in a batch.
   *
   * @param {string[]} fileIds - Array of file IDs to download.
   * @param {DownloadFileBatchOptions} options - Options for the batch download.
   * @returns {Promise<DownloadFileBatchResult>} The batch download results.
   *
   * @example
   * const gt = new GT({
   *   sourceLocale: 'en-US',
   *   targetLocale: 'es-ES',
   *   locales: ['en-US', 'es-ES', 'fr-FR']
   * });
   *
   * const result = await gt.downloadFileBatch(['1234567890', '1234567891'], {
   *   timeout: 10000,
   * });
   */
  async downloadFileBatch(
    fileIds: string[],
    options: DownloadFileBatchOptions = {}
  ): Promise<DownloadFileBatchResult> {
    // Validation
    this._validateAuth('downloadFileBatch');

    // Request the batch download
    return await _downloadFileBatch(
      fileIds,
      options,
      this._getTranslationConfig()
    );
  }

  /**
   * Fetches translation metadata and information.
   *
   * @param {string} versionId - The version ID to fetch translations for.
   * @param {FetchTranslationsOptions} options - Options for fetching translations.
   * @returns {Promise<FetchTranslationsResult>} The translation metadata and information.
   *
   * @example
   * const gt = new GT({
   *   sourceLocale: 'en-US',
   *   targetLocale: 'es-ES',
   *   locales: ['en-US', 'es-ES', 'fr-FR']
   * });
   *
   * const result = await gt.fetchTranslations('1234567890');
   */
  async fetchTranslations(
    versionId: string,
    options: FetchTranslationsOptions = {}
  ): Promise<FetchTranslationsResult> {
    // Validation
    this._validateAuth('fetchTranslations');

    // Request the translation metadata
    return await _fetchTranslations(
      versionId,
      options,
      this._getTranslationConfig()
    );
  }

  /**
   * Translates the source content to the target locale.
   * @deprecated Use the {@link translate} method instead.
   */
  // Overload for JSX content
  async _translate(
    source: JsxChildren,
    targetLocale: string,
    metadata?: Omit<EntryMetadata, 'dataFormat'> & {
      dataFormat?: 'JSX';
    }
  ): Promise<TranslationResult | TranslationError>;

  // Overload for ICU content
  /**
   * Translates the source content to the target locale.
   * @deprecated Use the {@link translate} method instead.
   */
  async _translate(
    source: IcuMessage,
    targetLocale: string,
    metadata?: Omit<EntryMetadata, 'dataFormat'> & {
      dataFormat?: 'ICU';
    }
  ): Promise<TranslationResult | TranslationError>;

  // Overload for I18next content
  /**
   * Translates the source content to the target locale.
   * @deprecated Use the {@link translate} method instead.
   */
  async _translate(
    source: I18nextMessage,
    targetLocale: string,
    metadata?: Omit<EntryMetadata, 'dataFormat'> & {
      dataFormat?: 'I18NEXT';
    }
  ): Promise<TranslationResult | TranslationError>;

  // Implementation
  /**
   * Translates the source content to the target locale.
   * @deprecated Use the {@link translate} method instead.
   */
  async _translate(
    source: Content,
    targetLocale: string | undefined = this.targetLocale,
    metadata?: EntryMetadata
  ): Promise<TranslationResult | TranslationError> {
    // Validation
    this._validateAuth('translate');

    // Require target locale
    if (!targetLocale) {
      const error = noTargetLocaleProvidedError('translate');
      gtInstanceLogger.error(error);
      throw new Error(error);
    }

    // Request the translation
    return await _translate(
      source,
      targetLocale,
      metadata,
      this._getTranslationConfig()
    );
  }

  /**
   * Translates the source content to the target locale.
   *
   * @param {Content} source - {@link JsxChildren} | {@link IcuMessage} | {@link I18nextMessage} The source content to translate.
   * @param {string} targetLocale - string The target locale to translate to.
   * @param {EntryMetadata} metadata - {@link EntryMetadata} The metadata for the translation.
   * @returns {Promise<TranslationResult | TranslationError>} The translated content.
   *
   * @example
   * const gt = new GT({
   *   sourceLocale: 'en-US',
   *   targetLocale: 'es-ES',
   *   locales: ['en-US', 'es-ES', 'fr-FR']
   * });
   *
   * const result = await gt.translate('Hello, world!', 'es-ES');
   *
   * @example
   * const gt = new GT({
   *   sourceLocale: 'en-US',
   *   targetLocale: 'es-ES',
   *   locales: ['en-US', 'es-ES', 'fr-FR']
   * });
   *
   * const result = await gt.translate('Hello, world!', 'es-ES', { context: 'A formal greeting'});
   */
  // Overload for JSX content
  async translate(
    source: JsxChildren,
    targetLocale: string,
    metadata?: Omit<EntryMetadata, 'dataFormat'> & {
      dataFormat?: 'JSX';
    }
  ): Promise<TranslationResult | TranslationError>;

  // Overload for ICU content
  async translate(
    source: IcuMessage,
    targetLocale: string,
    metadata?: Omit<EntryMetadata, 'dataFormat'> & {
      dataFormat?: 'ICU';
    }
  ): Promise<TranslationResult | TranslationError>;

  // Overload for I18next content
  async translate(
    source: I18nextMessage,
    targetLocale: string,
    metadata?: Omit<EntryMetadata, 'dataFormat'> & {
      dataFormat?: 'I18NEXT';
    }
  ): Promise<TranslationResult | TranslationError>;

  // Implementation
  async translate(
    source: Content,
    targetLocale: string | undefined = this.targetLocale,
    metadata?: EntryMetadata
  ): Promise<TranslationResult | TranslationError> {
    // Validation
    this._validateAuth('translate');

    // Require target locale
    if (!targetLocale) {
      const error = noTargetLocaleProvidedError('translate');
      gtInstanceLogger.error(error);
      throw new Error(error);
    }

    if (typeof this.customMapping?.[targetLocale] === 'object') {
      const { regionCode, scriptCode } = this.customMapping[targetLocale];
      metadata = {
        ...(regionCode && { regionCode }),
        ...(scriptCode && { scriptCode }),
        ...metadata,
      };
    }

    // Request the translation
    return await _translate(
      source,
      targetLocale,
      metadata,
      this._getTranslationConfig()
    );
  }

  /**
   * Translates multiple source contents to the target locale.
   * Override global metadata by supplying a metadata object for each request.
   *
   * @param {Entry[]} sources - The source contents to translate.
   * @param {EntryMetadata} globalMetadata - {@link EntryMetadata} The metadata for the translation.
   * @returns {Promise<TranslateManyResult>} The translated contents.
   *
   * @example
   * const gt = new GT({
   *   sourceLocale: 'en-US',
   *   targetLocale: 'es-ES',
   *   locales: ['en-US', 'es-ES', 'fr-FR']
   * });
   *
   * const result = await gt.translateMany([
   *   { source: 'Hello, world!' },
   *   { source: 'Goodbye, world!' },
   * ], { targetLocale: 'es-ES' });
   */
  async translateMany(
    sources: Entry[],
    globalMetadata?: { targetLocale: string } & EntryMetadata
  ): Promise<TranslateManyResult> {
    // Validation
    this._validateAuth('translateMany');

    // Require target locale
    const targetLocale = globalMetadata?.targetLocale || this.targetLocale;
    if (!targetLocale) {
      const error = noTargetLocaleProvidedError('translateMany');
      gtInstanceLogger.error(error);
      throw new Error(error);
    }

    globalMetadata = {
      ...globalMetadata,
      targetLocale,
    };

    if (typeof this.customMapping?.[targetLocale] === 'object') {
      const { regionCode, scriptCode } = this.customMapping[targetLocale];
      globalMetadata = {
        ...(regionCode && { regionCode }),
        ...(scriptCode && { scriptCode }),
        ...globalMetadata,
      };
    }

    // Request the translation
    return await _translateMany(
      sources,
      globalMetadata,
      this._getTranslationConfig()
    );
  }

  // -------------- Formatting -------------- //

  /**
   * Formats a message according to the specified locales and options.
   *
   * @param {string} message - The message to format.
   * @param {string | string[]} [locales='en'] - The locales to use for formatting.
   * @param {FormatVariables} [variables={}] - The variables to use for formatting.
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
    }
  ): string {
    return formatMessage(message, {
      locales: this._renderingLocales,
      ...options,
    });
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
    return formatNum(number, {
      locales: this._renderingLocales,
      ...options,
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
    return formatDateTime(date, {
      locales: this._renderingLocales,
      ...options,
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
    return formatCurrency(value, currency, {
      locales: this._renderingLocales,
      ...options,
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
      options: options,
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
    return formatRelativeTime(value, unit, {
      locales: this._renderingLocales,
      ...options,
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
    return getLocaleEmoji(locale, this.customMapping);
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
    return getLocaleProperties(locale, this.sourceLocale, this.customMapping);
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
   * const gt = new GT({ targetLocale: 'en-US' });
   * gt.getRegionProperties('US');
   * // => { code: 'US', name: 'United States', emoji: '🇺🇸' }
   *
   * @example
   * const gt = new GT({ targetLocale: 'fr-FR' });
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
    approvedLocales: string[] | undefined = this.locales
  ): boolean {
    if (!sourceLocale)
      throw new Error(noSourceLocaleProvidedError('requiresTranslation'));
    if (!targetLocale)
      throw new Error(noTargetLocaleProvidedError('requiresTranslation'));
    return _requiresTranslation(sourceLocale, targetLocale, approvedLocales);
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
    return getLocaleDirection(locale);
  }

  /**
   * Checks if a given BCP 47 locale code is valid.
   *
   * @param {string} [locale=this.targetLocale] - The BCP 47 locale code to validate
   * @param {customMapping} [customMapping=this.customMapping] - The custom mapping to use for validation
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
    return isValidLocale(locale, customMapping);
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
    return isSameDialect(...locales);
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
    return isSupersetLocale(superLocale, subLocale);
  }
}

// ============================================================ //
//                    Utility methods                           //
// ============================================================ //

// -------------- Formatting -------------- //

/**
 * Formats a message according to the specified locales and options.
 *
 * @param {string} message - The message to format.
 * @param {string | string[]} [locales='en'] - The locales to use for formatting.
 * @param {FormatVariables} [variables={}] - The variables to use for formatting.
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
  }
): string {
  return _formatMessage(message, options?.locales, options?.variables);
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
 * @internal
 *
 * @example
 * _getRegionProperties('US', 'en');
 * // => { code: 'US', name: 'United States', emoji: '🇺🇸' }
 *
 * @example
 * _getRegionProperties('US', 'fr');
 * // => { code: 'US', name: 'États-Unis', emoji: '🇺🇸' }
 *
 * @example
 * _getRegionProperties('US', 'en', { US: { name: 'USA', emoji: '🗽' } });
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
  approvedLocales?: string[]
): boolean {
  return _requiresTranslation(sourceLocale, targetLocale, approvedLocales);
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
