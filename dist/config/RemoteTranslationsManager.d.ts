/**
 * Configuration type for RemoteTranslationsManager.
 */
type RemoteTranslationsConfig = {
    cacheURL: string;
    projectId: string;
};
/**
 * Manages remote translations.
 */
export declare class RemoteTranslationsManager {
    private config;
    private translationsMap;
    private fetchPromises;
    private requestedTranslations;
    /**
     * Creates an instance of RemoteTranslationsManager.
     */
    constructor();
    /**
     * Sets the configuration for the RemoteTranslationsManager.
     * @param {Partial<RemoteTranslationsConfig>} newConfig - The new configuration to apply.
     */
    setConfig(newConfig: Partial<RemoteTranslationsConfig>): void;
    /**
     * Fetches translations from the remote cache.
     * @param {string} reference - The translation reference.
     * @returns {Promise<Record<string, any> | null>} The fetched translations or null if not found.
     */
    private _fetchTranslations;
    /**
     * Retrieves translations for a given locale.
     * @param {string} locale - The locale code.
     * @returns {Promise<Record<string, any> | null>} The translations data or null if not found.
     */
    getTranslations(locale: string): Promise<Record<string, any> | null>;
    /**
     * Sets a new translation entry.
     * @param {string} locale - The locale code.
     * @param {string} key - The key for the new entry.
     * @param {string} [id=key] - The id for the new entry, defaults to key if not provided.
     * @param {any} translation - The translation value.
     * @returns {boolean} True if the entry was set successfully, false otherwise.
     */
    setTranslations(locale: string, key: string, id: string | undefined, translation: any): boolean;
    /**
     * Marks translations as requested for a given locale
     */
    setTranslationRequested(locale: string): void;
    /**
     * Checks if translations have been requested for a given locale
     */
    getTranslationRequested(locale: string): boolean;
}
declare const remoteTranslationsManager: RemoteTranslationsManager;
export default remoteTranslationsManager;
//# sourceMappingURL=RemoteTranslationsManager.d.ts.map