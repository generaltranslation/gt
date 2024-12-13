import GT from 'generaltranslation';
type I18NConfigurationParams = {
    apiKey?: string;
    devApiKey?: string;
    projectId: string;
    cacheUrl: string;
    baseUrl: string;
    cacheExpiryTime?: number;
    defaultLocale: string;
    locales: string[];
    renderSettings: {
        method: 'skeleton' | 'replace' | 'hang' | 'subtle';
        timeout: number | null;
    };
    maxConcurrentRequests: number;
    batchInterval: number;
    env?: string;
    [key: string]: any;
};
export default class I18NConfiguration {
    apiKey?: string;
    devApiKey?: string;
    baseUrl: string;
    projectId: string;
    defaultLocale: string;
    locales: string[];
    renderSettings: {
        method: 'skeleton' | 'replace' | 'hang' | 'subtle';
        timeout: number | null;
    };
    env: string;
    private _remoteTranslationsManager;
    gt: GT;
    metadata: Record<string, any>;
    maxConcurrentRequests: number;
    batchInterval: number;
    private _queue;
    private _activeRequests;
    private _translationCache;
    private _taggedDictionary;
    private _template;
    constructor({ apiKey, devApiKey, projectId, baseUrl, cacheUrl, cacheExpiryTime, defaultLocale, locales, renderSettings, dictionary, maxConcurrentRequests, batchInterval, env, ...metadata }: I18NConfigurationParams);
    /**
     * Gets config for dynamic translation on the client side.
    */
    getClientSideConfig(): {
        projectId: string;
        devApiKey: string | undefined;
        baseUrl: string;
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
     * @returns A boolean indicating whether automatic translation is enabled or disabled for this config
     */
    translationEnabled(): boolean;
    /**
     * Get the rendering instructions
     * @returns An object containing the current method and timeout.
     * As of 7/31/24: method is "skeleton", "replace", "hang", "subtle".
     * Timeout is a number or null, representing no assigned timeout.
     */
    getRenderSettings(): {
        method: 'skeleton' | 'replace' | 'hang' | 'subtle';
        timeout: number | null;
    };
    /**
     * Check if translation is required based on the user's locale
     * @param locale - The user's locale
     * @returns True if translation is required, otherwise false
     */
    requiresTranslation(locale: string): boolean;
    /**
     * Check if the current environment is set to "development" or "test"
     * @returns True if the current environment is development
    */
    isDevelopmentEnvironment(): boolean;
    addGTIdentifier(children: any, id?: string): any;
    /**
     * @returns {[any, string]} A xxhash hash and the children that were created from it
    */
    serializeAndHash(children: any, context?: string, id?: string): [any, string];
    /**
     * Get the translation dictionaries for this user's locale, if they exist
     * Globally shared cache
     * @param locale - The locale set by the user
     * @returns A promise that resolves to the translations.
     */
    getTranslations(locale: string): Promise<Record<string, any>>;
    /**
     * Translate content into language associated with a given locale
     * @param params - Parameters for translation
     * @returns Translated string
     */
    translateContent(params: {
        source: string | (string | {
            key: string;
            variable?: string;
        })[];
        targetLocale: string;
        options: Record<string, any>;
    }): Promise<string>;
    /**
     * Translate the children components
     * @param params - Parameters for translation
     * @returns A promise that resolves when translation is complete
     */
    translateChildren(params: {
        source: any;
        targetLocale: string;
        metadata: Record<string, any>;
    }): Promise<any>;
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