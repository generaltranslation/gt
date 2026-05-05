import type { GT } from 'generaltranslation';
import {
  RenderMethod,
  getDefaultRenderSettings,
  defaultLocaleCookieName,
} from 'gt-react/internal';
import type {
  Dictionary,
  TranslatedChildren,
  Translations,
} from 'gt-react/internal';
import { defaultWithGTConfigProps } from './props/defaultWithGTConfigProps';
import { dictionaryManager, DictionaryManager } from './DictionaryManager';
import type { HeadersAndCookies } from './props/withGTConfigProps';
import {
  defaultLocaleRoutingEnabledCookieName,
  defaultReferrerLocaleCookieName,
  defaultResetLocaleCookieName,
} from '../utils/cookies';
import { defaultLocaleHeaderName } from '../utils/headers';
import type { CustomMapping } from 'generaltranslation/types';
import { I18nManager } from 'gt-i18n/internal';
import type { LookupOptions } from 'gt-i18n/internal/types';
import { loadTranslations } from './loadTranslation';

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

type RuntimeTranslationParams = {
  source: TranslatedChildren;
  targetLocale: string;
  options: LookupOptions;
};

export class I18NConfiguration {
  // Feature flags
  translationEnabled: boolean;
  developmentApiEnabled: boolean;
  productionApiEnabled: boolean;
  dictionaryEnabled: boolean;
  // Cloud integration
  projectId?: string;
  devApiKey?: string;
  runtimeUrl: string | undefined;
  // Rendering
  renderSettings: {
    method: RenderMethod;
    timeout?: number;
  };
  // Dictionaries
  private _i18nManager: I18nManager<TranslatedChildren>;
  private _dictionaryManager: DictionaryManager | undefined;
  // Headers and cookies
  private localeHeaderName: string;
  private localeCookieName: string;
  private referrerLocaleCookieName: string;
  private localeRoutingEnabledCookieName: string;
  private resetLocaleCookieName: string;
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
    // Dictionary files are resolved by dictionaryManager; do not forward the
    // public dictionary prop as runtime translation metadata.
    dictionary: _dictionary,
    // Batching config
    maxConcurrentRequests,
    maxBatchSize,
    batchInterval,
    // Internal
    _usingPlugin,
    headersAndCookies,
    customMapping,
    // Other metadata
    ...metadata
  }: I18NConfigurationParams) {
    void _dictionary;

    // ----- CLOUD INTEGRATION ----- //

    this.devApiKey = devApiKey;
    this.projectId = projectId;
    this.runtimeUrl = runtimeUrl;

    // Enables locale-based translation lookups through I18nManager. Runtime API
    // availability is tracked separately by developmentApiEnabled/productionApiEnabled.
    this.translationEnabled = !!(
      (
        loadTranslationsType === 'custom' || // load local translation
        (loadTranslationsType === 'remote' &&
          this.projectId && // projectId required because it's part of the GET request
          cacheUrl) ||
        loadDictionaryEnabled
      ) // load local dictionary
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
    this.productionApiEnabled = !!(runtimeApiEnabled && apiKey);

    // dictionary enabled
    this.dictionaryEnabled = _usingPlugin;

    // ----- SETUP ----- //

    // Render method
    const defaultRenderSettings = getDefaultRenderSettings(
      process.env.NODE_ENV
    );
    this.renderSettings = {
      method: renderSettings?.method || defaultRenderSettings.method,
      ...((renderSettings?.timeout !== undefined ||
        defaultRenderSettings.timeout !== undefined) && {
        timeout: renderSettings?.timeout || defaultRenderSettings.timeout,
      }),
    };
    // Translation and dictionary managers
    const shouldLoadTranslations = loadTranslationsType !== 'disabled';
    const runtimeTranslationTimeout = this.renderSettings.timeout;
    this._i18nManager = new I18nManager<TranslatedChildren>({
      apiKey,
      devApiKey,
      projectId,
      runtimeUrl,
      // Locale info
      defaultLocale,
      locales,
      // Custom mapping
      customMapping,
      enableI18n: this.translationEnabled,
      // Batching config
      batchConfig: {
        maxConcurrentRequests,
        maxBatchSize,
        batchInterval,
      },
      runtimeTranslation: {
        timeout: runtimeTranslationTimeout,
        // Other metadata
        metadata: {
          sourceLocale: defaultLocale,
          ...(runtimeTranslationTimeout && {
            timeout: runtimeTranslationTimeout,
          }),
          projectId,
          publish: true,
          fast: true,
          ...metadata,
        },
      },
      cacheUrl: shouldLoadTranslations ? cacheUrl : null,
      // Only apply cache expiry for remote translations; custom loaders manage
      // their own freshness, and historically their caches were never evicted.
      cacheExpiryTime:
        loadTranslationsType === 'remote' ? (cacheExpiryTime ?? null) : null,
      _versionId,
      environment:
        process.env.NODE_ENV === 'development' ? 'development' : 'production',
      ...(shouldLoadTranslations && {
        loadTranslations: async (locale: string) =>
          (await loadTranslations({
            targetLocale: locale,
            ...(cacheUrl && { cacheUrl }),
            ...(projectId && { projectId }),
            ...(_versionId && { _versionId }),
          })) || {},
      }),
    });
    this._dictionaryManager = dictionaryManager;
    // Headers and cookies
    this.localeHeaderName =
      headersAndCookies?.localeHeaderName || defaultLocaleHeaderName;
    this.localeCookieName =
      headersAndCookies?.localeCookieName || defaultLocaleCookieName;
    this.referrerLocaleCookieName =
      headersAndCookies?.referrerLocaleCookieName ||
      defaultReferrerLocaleCookieName;
    this.localeRoutingEnabledCookieName =
      headersAndCookies?.localeRoutingEnabledCookieName ||
      defaultLocaleRoutingEnabledCookieName;
    this.resetLocaleCookieName =
      headersAndCookies?.resetLocaleCookieName || defaultResetLocaleCookieName;
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
    } = this;
    const customMapping = this._i18nManager.getCustomMapping();
    const _versionId = this._i18nManager.getVersionId();
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
      _versionId,
    };
  }

  /**
   * Gets the GT class instance
   * @returns {GT} The GT class instance
   */
  getGTClass(): GT {
    return this._i18nManager.getGTClass();
  }

  // ----- LOCALES ----- //

  /**
   * Gets the application's default locale
   * @returns {string} A BCP-47 locale tag
   */
  getDefaultLocale(): string {
    return this._i18nManager.getDefaultLocale();
  }

  /**
   * Gets the list of approved locales for this app
   * @returns {string[]} A list of BCP-47 locale tags, or undefined if none were provided
   */
  getLocales(): string[] {
    return this._i18nManager.getLocales();
  }

  /**
   * Gets the version ID for the current source
   * @returns {string | undefined} The version ID, if set
   */
  getVersionId(): string | undefined {
    return this._i18nManager.getVersionId();
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
    return [
      this._i18nManager.requiresTranslation(locale),
      this._i18nManager.requiresDialectTranslation(locale),
    ];
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
    return (await this._i18nManager.loadTranslations(locale)) as Translations;
  }

  // ----- RUNTIME TRANSLATION ----- //

  lookupTranslation({
    source,
    targetLocale,
    options,
  }: RuntimeTranslationParams): TranslatedChildren | undefined {
    return this._i18nManager.lookupTranslation(targetLocale, source, options);
  }

  async translate({
    source,
    targetLocale,
    options,
  }: RuntimeTranslationParams): Promise<TranslatedChildren> {
    const translation = await this._i18nManager.lookupTranslationWithFallback(
      targetLocale,
      source,
      options
    );
    if (translation == null) {
      throw new Error('Translation failed.');
    }
    return translation;
  }
}
