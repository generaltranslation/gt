import GT from 'generaltranslation';
type I18NConfigurationParams = {
    apiKey: string;
    projectId: string;
    cacheURL: string;
    baseURL: string;
    defaultLocale: string;
    locales?: string[];
    renderSettings: {
        method: 'skeleton' | 'replace' | 'hang' | 'subtle';
        timeout: number | null;
    };
    translations?: Record<string, () => Promise<Record<string, any>>>;
    maxConcurrentRequests: number;
    batchInterval: number;
    env?: string;
    [key: string]: any;
};
export default class I18NConfiguration {
    baseURL: string;
    projectId: string;
    defaultLocale: string;
    locales: string[] | undefined;
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
    constructor({ apiKey, projectId, baseURL, cacheURL, defaultLocale, locales, renderSettings, dictionary, maxConcurrentRequests, batchInterval, env, ...metadata }: I18NConfigurationParams);
    /**
     * Gets the application's default locale
     * @returns {string} A BCP-47 locale tag
     */
    getDefaultLocale(): string;
    /**
     * Gets the list of approved locales for this app
     * @returns {string[] | undefined} A list of BCP-47 locale tags, or undefined if none were provided
     */
    getLocales(): string[] | undefined;
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
    translate(params: {
        content: string | (string | {
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
        children: any;
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