import { RenderMethod, TranslatedChildren, TranslatedContent, DictionaryObject } from 'gt-react/internal';
import { Content, JsxChildren } from 'generaltranslation/internal';
import { TranslationsObject } from 'gt-react/internal';
import { HeadersAndCookies } from './props/withGTConfigProps';
type I18NConfigurationParams = {
    apiKey?: string;
    devApiKey?: string;
    projectId?: string;
    runtimeUrl: string | undefined;
    cacheUrl: string | null;
    cacheExpiryTime: number;
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
    [key: string]: any;
};
export default class I18NConfiguration {
    translationEnabled: boolean;
    developmentApiEnabled: boolean;
    productionApiEnabled: boolean;
    dictionaryEnabled: boolean;
    projectId?: string;
    apiKey?: string;
    devApiKey?: string;
    runtimeUrl: string | undefined;
    cacheUrl: string | null;
    cacheExpiryTime: number;
    _versionId?: string;
    defaultLocale: string;
    locales: string[];
    renderSettings: {
        method: RenderMethod;
        timeout?: number;
    };
    private _translationManager;
    private _dictionaryManager;
    metadata: Record<string, any>;
    maxConcurrentRequests: number;
    maxBatchSize: number;
    batchInterval: number;
    private _queue;
    private _activeRequests;
    private _translationCache;
    private localeHeaderName;
    private localeCookieName;
    private referrerLocaleCookieName;
    private localeRoutingEnabledCookieName;
    private resetLocaleCookieName;
    constructor({ apiKey, devApiKey, projectId, _versionId, runtimeUrl, cacheUrl, cacheExpiryTime, loadTranslationsType, loadDictionaryEnabled, defaultLocale, locales, renderSettings, dictionary, maxConcurrentRequests, maxBatchSize, batchInterval, _usingPlugin, headersAndCookies, ...metadata }: I18NConfigurationParams);
    /**
     * Get the rendering instructions
     * @returns An object containing the current method and timeout.
     * As of 1/22/25: method is "skeleton", "replace", "default".
     * Timeout is a number or null, representing no assigned timeout.
     */
    getRenderSettings(): {
        method: RenderMethod;
        timeout?: number;
    };
    /**
     * Gets config for dynamic translation on the client side.
     */
    getClientSideConfig(): {
        projectId: string | undefined;
        translationEnabled: boolean;
        runtimeUrl: string | undefined;
        devApiKey: string | undefined;
        dictionaryEnabled: boolean;
        renderSettings: {
            method: RenderMethod;
            timeout?: number;
        };
        runtimeTranslationEnabled: boolean;
        localeRoutingEnabledCookieName: string;
        referrerLocaleCookieName: string;
        localeCookieName: string;
        resetLocaleCookieName: string;
    };
    /**
     * Gets the application's default locale
     * @returns {string} A BCP-47 locale tag
     */
    getDefaultLocale(): string;
    /**
     * Gets the list of approved locales for this app
     * @returns {string[]} A list of BCP-47 locale tags, or undefined if none were provided
     */
    getLocales(): string[];
    getLocaleCookieName(): string;
    getLocaleHeaderName(): string;
    /**
     * @returns true if build time translation is enabled
     */
    isTranslationEnabled(): boolean;
    /**
     * @returns true if dictionaries are enabled
     */
    isDictionaryEnabled(): boolean;
    /**
     * @returns true if development runtime translation API is enabled
     */
    isDevelopmentApiEnabled(): boolean;
    /**
     * @returns true if production runtime translation API is enabled
     */
    isProductionApiEnabled(): boolean;
    /**
     * Check if translation is required based on the user's locale
     * @param locale - The user's locale
     * @returns True if translation is required, otherwise false
     */
    requiresTranslation(locale: string): [boolean, boolean];
    /**
     * Load the user's translations for a given locale
     * @param locale - The locale set by the user
     * @returns A promise that resolves to the translations.
     */
    getDictionaryTranslations(locale: string): Promise<DictionaryObject | undefined>;
    /**
     * Get the translation dictionaries for this user's locale, if they exist
     * Globally shared cache or saved locally
     * @param locale - The locale set by the user
     * @returns A promise that resolves to the translations.
     */
    getCachedTranslations(locale: string): Promise<TranslationsObject>;
    /**
     * Synchronously retrieves translations for a given locale which are already cached locally
     * @param {string} locale - The locale code.
     * @returns {TranslationsObject} The translations data or an empty object if not found.
     */
    getRecentTranslations(locale: string): TranslationsObject;
    /**
     * Translate content into language associated with a given locale
     * @param params - Parameters for translation
     * @returns Translated string
     */
    translateContent(params: {
        source: Content;
        targetLocale: string;
        options: {
            hash: string;
        } & Record<string, any>;
    }): Promise<TranslatedContent>;
    /**
     * Translate the children components
     * @param params - Parameters for translation
     * @returns A promise that resolves when translation is complete
     */
    translateJsx(params: {
        source: JsxChildren;
        targetLocale: string;
        options: {
            hash: string;
        } & Record<string, any>;
    }): Promise<TranslatedChildren>;
    /**
     * Send a batch request for React translation
     * @param batch - The batch of requests to be sent
     */
    private _sendBatchRequest;
    /**
     * Start the batching process with a set interval
     */
    private _startBatching;
}
export {};
//# sourceMappingURL=I18NConfiguration.d.ts.map