import { requiresTranslation, GT, isSameLanguage } from 'generaltranslation';
import translationManager, { TranslationManager } from './TranslationManager';
import {
  RenderMethod,
  TranslatedChildren,
  defaultRenderSettings,
  defaultLocaleCookieName,
  Dictionary,
} from 'gt-react/internal';
import {
  createMismatchingHashWarning,
  runtimeTranslationTimeoutWarning,
} from '../errors/createErrors';
import { _Content, JsxChildren } from 'generaltranslation/internal';
import { Translations } from 'gt-react/internal';
import defaultWithGTConfigProps from './props/defaultWithGTConfigProps';
import dictionaryManager, { DictionaryManager } from './DictionaryManager';
import { HeadersAndCookies } from './props/withGTConfigProps';
import {
  defaultLocaleRoutingEnabledCookieName,
  defaultReferrerLocaleCookieName,
  defaultResetLocaleCookieName,
} from '../utils/cookies';
import { defaultLocaleHeaderName } from '../utils/headers';
import { CustomMapping } from 'generaltranslation/types';
import { GTTranslationError } from '../utils/errors';
type I18NConfigurationParams = {
  apiKey?: string;
  devApiKey?: string;
  projectId?: string;
  runtimeUrl: string | undefined;
  cacheUrl: string | null;
  cacheExpiryTime?: number;
  loadTranslationsType: 'remote' | 'custom' | 'disabled';
  loadDictionaryEnabled: boolean;
  defaultLocale: string;
  locales: string[];
  renderSettings: {
    method: RenderMethod;
    timeout?: number;
  };
  maxConcurrentRequests: number;
  maxBatchSize: number;
  batchInterval: number;
  headersAndCookies: HeadersAndCookies;
  _usingPlugin: boolean;
  customMapping?: CustomMapping | undefined;
  [key: string]: any;
};

type QueueEntry =
  | {
      dataFormat: 'I18NEXT' | 'ICU';
      source: _Content;
      targetLocale: string;
      metadata: { hash: string } & Record<string, any>;
      resolve: (
        value: TranslatedChildren | PromiseLike<TranslatedChildren>
      ) => void;
      reject: (reason?: any) => void;
    }
  | {
      dataFormat: 'JSX';
      source: JsxChildren;
      targetLocale: string;
      metadata: { hash: string } & Record<string, any>;
      resolve: (
        value: TranslatedChildren | PromiseLike<TranslatedChildren>
      ) => void;
      reject: (reason?: any) => void;
    };

export default class I18NConfiguration {
  // Feature flags
  translationEnabled: boolean;
  developmentApiEnabled: boolean;
  productionApiEnabled: boolean;
  dictionaryEnabled: boolean;
  // Cloud integration
  projectId?: string;
  apiKey?: string;
  devApiKey?: string;
  runtimeUrl: string | undefined;
  cacheUrl: string | null;
  cacheExpiryTime?: number;
  _versionId?: string;
  // Locale info
  defaultLocale: string;
  locales: string[];
  // Rendering
  renderSettings: {
    method: RenderMethod;
    timeout?: number;
  };
  // Dictionaries
  private _translationManager: TranslationManager | undefined;
  private _dictionaryManager: DictionaryManager | undefined;
  // Other metadata
  metadata: Record<string, any>;
  // Batching config
  maxConcurrentRequests: number;
  maxBatchSize: number;
  batchInterval: number;
  private _queue: Array<QueueEntry>;
  private _activeRequests: number;
  // Cache for ongoing translation requests
  private _translationCache: Map<string, Promise<any>>;
  // Headers and cookies
  private localeHeaderName: string;
  private localeCookieName: string;
  private referrerLocaleCookieName: string;
  private localeRoutingEnabledCookieName: string;
  private resetLocaleCookieName: string;
  // Custom mapping
  private customMapping: CustomMapping | undefined;
  private gt: GT;
  constructor({
    // Cloud integration
    apiKey,
    devApiKey,
    projectId,
    _versionId,
    runtimeUrl,
    cacheUrl,
    cacheExpiryTime,
    loadTranslationsType,
    loadDictionaryEnabled,
    // Locale info
    defaultLocale,
    locales,
    // Render method
    renderSettings,
    // Dictionaries
    dictionary,
    // Batching config
    maxConcurrentRequests,
    maxBatchSize,
    batchInterval,
    // Internal
    _usingPlugin,
    // Other metadata
    headersAndCookies,
    customMapping,
    ...metadata
  }: I18NConfigurationParams) {
    // ----- CLOUD INTEGRATION ----- //

    this.apiKey = apiKey;
    this.devApiKey = devApiKey;
    this.projectId = projectId;
    this.runtimeUrl = runtimeUrl;
    this.cacheUrl = cacheUrl;
    this.cacheExpiryTime = cacheExpiryTime;
    this._versionId = _versionId; // version id for the dictionary

    // buildtime translation enabled
    this.translationEnabled = !!(
      loadTranslationsType === 'custom' || // load local translation
      (loadTranslationsType === 'remote' &&
        this.projectId && // projectId required because it's part of the GET request
        this.cacheUrl) ||
      loadDictionaryEnabled // load local dictionary
    );

    // runtime translation enabled
    const runtimeApiEnabled = !!(this.runtimeUrl ===
    defaultWithGTConfigProps.runtimeUrl
      ? this.projectId
      : this.runtimeUrl);
    this.developmentApiEnabled = !!(
      runtimeApiEnabled &&
      this.devApiKey &&
      process.env.NODE_ENV === 'development'
    );
    this.productionApiEnabled = !!(runtimeApiEnabled && this.apiKey);

    // dictionary enabled
    this.dictionaryEnabled = _usingPlugin;

    // ----- SETUP ----- //

    // Locales
    this.defaultLocale = defaultLocale;
    this.locales = locales;
    // Render method
    this.renderSettings = {
      method: renderSettings.method,
      ...((renderSettings.timeout !== undefined ||
        defaultRenderSettings.timeout !== undefined) && {
        timeout: renderSettings.timeout || defaultRenderSettings.timeout,
      }),
    };
    // Other metadata
    this.metadata = {
      sourceLocale: this.defaultLocale,
      ...(this.renderSettings.timeout && {
        timeout: this.renderSettings.timeout,
      }),
      projectId: this.projectId,
      publish: true,
      fast: true,
      ...metadata,
    };
    // Custom mapping
    this.customMapping = customMapping;
    this.gt = new GT({
      apiKey,
      devApiKey,
      sourceLocale: defaultLocale,
      projectId,
      baseUrl: runtimeUrl,
      customMapping,
    });
    // Dictionary managers
    this._translationManager = translationManager;
    this._dictionaryManager = dictionaryManager;
    this._translationManager.setConfig({
      cacheUrl,
      projectId,
      translationEnabled: this.translationEnabled,
      _versionId,
      cacheExpiryTime: this.cacheExpiryTime,
      loadTranslationsType: loadTranslationsType,
    });
    // Batching
    this.maxConcurrentRequests = maxConcurrentRequests;
    this.maxBatchSize = maxBatchSize;
    this.batchInterval = batchInterval;
    this._queue = [];
    this._activeRequests = 0;
    this._translationCache = new Map(); // cache for ongoing promises, so things aren't translated twice
    this._startBatching();
    // Headers and cookies
    this.localeHeaderName =
      headersAndCookies.localeHeaderName || defaultLocaleHeaderName;
    this.localeCookieName =
      headersAndCookies.localeCookieName || defaultLocaleCookieName;
    this.referrerLocaleCookieName =
      headersAndCookies.referrerLocaleCookieName ||
      defaultReferrerLocaleCookieName;
    this.localeRoutingEnabledCookieName =
      headersAndCookies.localeRoutingEnabledCookieName ||
      defaultLocaleRoutingEnabledCookieName;
    this.resetLocaleCookieName =
      headersAndCookies.resetLocaleCookieName || defaultResetLocaleCookieName;
  }

  // ------ CONFIG ----- //

  /**
   * Get the rendering instructions
   * @returns An object containing the current method and timeout.
   * As of 1/22/25: method is "skeleton", "replace", "default".
   * Timeout is a number or null, representing no assigned timeout.
   */
  getRenderSettings(): {
    method: RenderMethod;
    timeout?: number;
  } {
    return this.renderSettings;
  }

  /**
   * Gets config for dynamic translation on the client side.
   */
  getClientSideConfig() {
    const {
      projectId,
      translationEnabled,
      runtimeUrl,
      devApiKey,
      developmentApiEnabled,
      dictionaryEnabled,
      renderSettings,
      localeRoutingEnabledCookieName,
      referrerLocaleCookieName,
      localeCookieName,
      resetLocaleCookieName,
      customMapping,
    } = this;
    return {
      projectId,
      translationEnabled,
      runtimeUrl,
      devApiKey,
      dictionaryEnabled,
      renderSettings,
      developmentApiEnabled,
      localeRoutingEnabledCookieName,
      referrerLocaleCookieName,
      localeCookieName,
      resetLocaleCookieName,
      customMapping,
    };
  }

  /**
   * Gets the GT class instance
   * @returns {GT} The GT class instance
   */
  getGTClass(): GT {
    return this.gt;
  }

  // ----- LOCALES ----- //

  /**
   * Gets the application's default locale
   * @returns {string} A BCP-47 locale tag
   */
  getDefaultLocale(): string {
    return this.defaultLocale;
  }

  /**
   * Gets the list of approved locales for this app
   * @returns {string[]} A list of BCP-47 locale tags, or undefined if none were provided
   */
  getLocales(): string[] {
    return this.locales;
  }

  // ----- COOKIES AND HEADERS ----- //

  getLocaleCookieName(): string {
    return this.localeCookieName;
  }

  getLocaleHeaderName(): string {
    return this.localeHeaderName;
  }

  // ----- FEATURE FLAGS ----- //

  /**
   * @returns true if build time translation is enabled
   */
  isTranslationEnabled(): boolean {
    return this.translationEnabled;
  }

  /**
   * @returns true if dictionaries are enabled
   */
  isDictionaryEnabled(): boolean {
    return this.dictionaryEnabled;
  }

  /**
   * @returns true if development runtime translation API is enabled
   */
  isDevelopmentApiEnabled(): boolean {
    return this.developmentApiEnabled;
  }

  /**
   * @returns true if production runtime translation API is enabled
   */
  isProductionApiEnabled(): boolean {
    return this.productionApiEnabled;
  }

  // ----- UTILITY FUNCTIONS ----- //

  /**
   * Check if translation is required based on the user's locale
   * @param locale - The user's locale
   * @returns True if translation is required, otherwise false
   */
  requiresTranslation(locale: string): [boolean, boolean] {
    if (!this.translationEnabled) return [false, false];
    const translationRequired = this.gt.requiresTranslation(
      this.defaultLocale,
      locale,
      this.locales
    );
    const dialectTranslationRequired =
      translationRequired && isSameLanguage(locale, this.defaultLocale);
    return [translationRequired, dialectTranslationRequired];
  }

  // ----- DICTIONARY ----- //
  // User defined translations are called dictionary

  /**
   * Load the user's translations for a given locale
   * @param locale - The locale set by the user
   * @returns A promise that resolves to the translations.
   */
  async getDictionaryTranslations(
    locale: string
  ): Promise<Dictionary | undefined> {
    return await this._dictionaryManager?.getDictionary(locale);
  }

  /**
   * Set the dictionary for a given locale
   * @param {string} locale - The locale code.
   * @param {Dictionary} dictionary - The dictionary data.
   */
  setDictionaryTranslations(locale: string, dictionary: Dictionary) {
    this._dictionaryManager?.setDictionary(locale, dictionary);
  }

  // ----- CACHED TRANSLATIONS ----- //

  /**
   * Get the translation dictionaries for this user's locale, if they exist
   * Globally shared cache or saved locally
   * @param locale - The locale set by the user
   * @returns A promise that resolves to the translations.
   */
  async getCachedTranslations(locale: string): Promise<Translations> {
    return (
      (await this._translationManager?.getCachedTranslations(locale)) || {}
    );
  }

  /**
   * Synchronously retrieves translations for a given locale which are already cached locally
   * @param {string} locale - The locale code.
   * @returns {Translations} The translations data or an empty object if not found.
   */
  getRecentTranslations(locale: string): Translations {
    return this._translationManager?.getRecentTranslations(locale) || {};
  }

  // ----- RUNTIME TRANSLATION ----- //

  private async _translateContent(
    params: {
      source: _Content;
      targetLocale: string;
      options: { hash: string } & Record<string, any>;
    },
    dataFormat: 'I18NEXT' | 'ICU'
  ): Promise<TranslatedChildren> {
    // check internal cache
    const cacheKey = constructCacheKey(params.targetLocale, params.options);
    if (this._translationCache.has(cacheKey)) {
      return this._translationCache.get(cacheKey);
    }

    // add to tx queue
    const { source, targetLocale, options } = params;
    const translationPromise = new Promise<TranslatedChildren>(
      (resolve, reject) => {
        this._queue.push({
          dataFormat,
          source,
          targetLocale,
          metadata: options,
          resolve,
          reject,
        });
      }
    ).catch((error) => {
      this._translationCache.delete(cacheKey);
      throw new Error(error);
    });

    this._translationCache.set(cacheKey, translationPromise);
    return translationPromise;
  }

  /**
   * Translate content into language associated with a given locale
   * @param params - Parameters for translation
   * @returns Translated string
   */
  async translateI18Next(params: {
    source: _Content;
    targetLocale: string;
    options: { hash: string } & Record<string, any>;
  }): Promise<TranslatedChildren> {
    return this._translateContent(params, 'I18NEXT');
  }

  /**
   * Translate content into language associated with a given locale
   * @param params - Parameters for translation
   * @returns Translated string
   */
  async translateIcu(params: {
    source: _Content;
    targetLocale: string;
    options: { hash: string } & Record<string, any>;
  }): Promise<TranslatedChildren> {
    return this._translateContent(params, 'ICU');
  }

  /**
   * Translate the children components
   * @param params - Parameters for translation
   * @returns A promise that resolves when translation is complete
   */
  async translateJsx(params: {
    source: JsxChildren;
    targetLocale: string;
    options: { hash: string } & Record<string, any>;
  }): Promise<TranslatedChildren> {
    // In memory cache to make sure the same translation isn't requested twice
    const { source, targetLocale, options } = params;
    const cacheKey = constructCacheKey(targetLocale, options);
    if (this._translationCache.has(cacheKey)) {
      return this._translationCache.get(cacheKey);
    }
    // Add to translation queue
    const translationPromise = new Promise<TranslatedChildren>(
      (resolve, reject) => {
        // In memory queue to batch requests
        this._queue.push({
          dataFormat: 'JSX',
          source,
          targetLocale,
          metadata: options,
          resolve,
          reject,
        });
      }
    ).catch((error) => {
      this._translationCache.delete(cacheKey);
      throw new Error(error);
    });
    this._translationCache.set(cacheKey, translationPromise);
    return translationPromise;
  }

  /**
   * Send a batch request for React translation
   * @param batch - The batch of requests to be sent
   */
  private async _sendBatchRequest(batch: Array<QueueEntry>): Promise<void> {
    this._activeRequests++;
    try {
      // ----- TRANSLATION REQUEST WITH ABORT CONTROLLER ----- //
      const results = await this.gt.translateMany(
        batch.map((item) => {
          const { source, metadata, dataFormat } = item;
          return { source, metadata, dataFormat };
        }),
        {
          ...this.metadata,
          targetLocale: batch[0].targetLocale,
        }
      );

      // ----- PROCESS RESPONSE ----- //
      batch.forEach((request, index) => {
        // check if entry is missing
        const result = results[index];

        const errorMsg = 'Translation failed.';
        const errorCode = 500;

        const hash = request.metadata.hash;
        if (result && typeof result === 'object') {
          if ('translation' in result) {
            // record translations
            if (this._translationManager) {
              this._translationManager.setTranslations(
                request.targetLocale,
                hash,
                result.translation
              );
            }
            // check for mismatching ids or hashes
            if (result.reference.hash !== hash) {
              console.warn(
                createMismatchingHashWarning(
                  hash,
                  result.reference?.hash || 'unknown hash'
                )
              );
            }
            return request.resolve(result.translation);
          }
        }
        return request.reject(new GTTranslationError(errorMsg, errorCode));
      });
    } catch (error) {
      // Error logging
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn(runtimeTranslationTimeoutWarning); // Warning for timeout
      } else {
        console.warn(error);
      }
      // Reject all promises
      batch.forEach((request) => {
        return request.reject(new GTTranslationError(String(error), 500));
      });
    } finally {
      this._activeRequests--;
    }
  }

  /**
   * Start the batching process with a set interval
   */
  private _startBatching(): void {
    setInterval(() => {
      if (
        this._queue.length > 0 &&
        this._activeRequests < this.maxConcurrentRequests
      ) {
        const batchSize = Math.min(this.maxBatchSize, this._queue.length);
        this._sendBatchRequest(this._queue.slice(0, batchSize));
        this._queue = this._queue.slice(batchSize);
      }
    }, this.batchInterval);
  }
}

// Constructs the unique identification key for the map which is the in-memory same-render-cycle cache
const constructCacheKey = (
  targetLocale: string,
  metadata: Record<string, any>
) => {
  return `${targetLocale}-${metadata.hash}`;
};
