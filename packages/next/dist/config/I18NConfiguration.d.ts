import { RenderMethod, TranslatedChildren, TranslatedContent, Children } from 'gt-react/internal';
import { Content, JsxChildren } from 'generaltranslation/internal';
import { TaggedChildren, TranslationsObject } from 'gt-react/internal';
type I18NConfigurationParams = {
    apiKey?: string;
    devApiKey?: string;
    projectId?: string;
    runtimeUrl: string | null;
    cacheUrl: string | null;
    translationLoaderType: 'remote' | 'custom' | 'disabled';
    cacheExpiryTime?: number;
    defaultLocale: string;
    locales: string[];
    renderSettings: {
        method: RenderMethod;
        timeout?: number;
    };
    maxConcurrentRequests: number;
    maxBatchSize: number;
    batchInterval: number;
    _usingPlugin: boolean;
    [key: string]: any;
};
export default class I18NConfiguration {
    translationEnabled: boolean;
    serverRuntimeTranslationEnabled: boolean;
    clientRuntimeTranslationEnabled: boolean;
    translationLoaderEnabled: boolean;
    projectId?: string;
    apiKey?: string;
    devApiKey?: string;
    runtimeUrl: string | null;
    cacheUrl: string | null;
    _versionId?: string;
    defaultLocale: string;
    locales: string[];
    renderSettings: {
        method: RenderMethod;
        timeout?: number;
    };
    private _remoteTranslationsManager;
    metadata: Record<string, any>;
    maxConcurrentRequests: number;
    maxBatchSize: number;
    batchInterval: number;
    private _queue;
    private _activeRequests;
    private _translationCache;
    private _taggedDictionary;
    private _template;
    private _usingPlugin;
    constructor({ apiKey, devApiKey, projectId, _versionId, runtimeUrl, cacheUrl, cacheExpiryTime, translationLoaderType, defaultLocale, locales, renderSettings, dictionary, maxConcurrentRequests, maxBatchSize, batchInterval, _usingPlugin, ...metadata }: I18NConfigurationParams);
    /**
     * Gets config for dynamic translation on the client side.
     */
    getClientSideConfig(): {
        projectId: string | undefined;
        devApiKey: string | undefined;
        runtimeUrl: string | null;
        translationEnabled: boolean;
        runtimeTranslationEnabled: boolean;
        dictionaryEnabled: boolean;
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
    /**
     * @returns true if dictionaries are enabled
     */
    isDictionaryEnabled(): boolean;
    /**
     * @returns A boolean indicating whether automatic translation is enabled or disabled for this config
     */
    isTranslationEnabled(): boolean;
    /**
     * Runtime translation is enabled on server side
     * @returns {boolean} A boolean indicating whether the dev runtime translation is enabled
     */
    isServerRuntimeTranslationEnabled(): boolean;
    /**
     * Runtime translation for clientside
     * @returns {boolean} A boolean indicating whether the client runtime translation is enabled
     */
    isClientRuntimeTranslationEnabled(): boolean;
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
     * Check if translation is required based on the user's locale
     * @param locale - The user's locale
     * @returns True if translation is required, otherwise false
     */
    requiresTranslation(locale: string): boolean;
    addGTIdentifier(children: Children): TaggedChildren;
    /**
     * @param {TaggedChildren} children - The children to be serialized
     * @param {string} context - The context in which the children are being serialized
     * @returns {[JsxChildren, string]} Serialized children and SHA256 hash generated from it
     */
    serializeAndHashChildren(children: TaggedChildren, context?: string): [JsxChildren, string];
    /**
     * @param {Content} content - The content to be hashed
     * @param {string} context - The context in which the content are being hashed
     * @returns {string} A SHA256 hash of the content
     */
    hashContent(content: Content, context?: string): string;
    /**
     * Get the translation dictionaries for this user's locale, if they exist
     * Globally shared cache or saved locally
     * @param locale - The locale set by the user
     * @returns A promise that resolves to the translations.
     */
    getCachedTranslations(locale: string): Promise<TranslationsObject>;
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
    translateChildren(params: {
        source: JsxChildren;
        targetLocale: string;
        metadata: {
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