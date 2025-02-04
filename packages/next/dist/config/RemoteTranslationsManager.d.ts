import { TranslationsObject, TranslationLoading, TranslationError, TranslationSuccess } from 'gt-react/internal';
/**
 * Configuration type for RemoteTranslationsManager.
 * @typedef {object} RemoteTranslationsConfig
 * @property {string} cacheUrl - The URL of the remote cache.
 * @property {string} projectId - The project identifier for translations.
 * @property {number} [cacheExpiryTime=60000] - The cache expiration time in milliseconds.
 */
type RemoteTranslationsConfig = {
    cacheUrl: string;
    projectId: string;
    cacheExpiryTime?: number;
};
/**
 * Manages remote translations.
 */
export declare class RemoteTranslationsManager {
    private config;
    private translationsMap;
    private fetchPromises;
    private requestedTranslations;
    private lastFetchTime;
    /**
     * Creates an instance of RemoteTranslationsManager.
     * @constructor
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
     * @returns {Promise<TranslationsObject | undefined>} The fetched translations or null if not found.
     */
    private _fetchTranslations;
    /**
     * Checks if translations are expired based on the configured TTL.
     * @param {string} reference - The translation reference.
     * @returns {boolean} True if expired, false otherwise.
     */
    private _isExpired;
    /**
     * Retrieves translations for a given locale from the remote or local cache.
     * @param {string} locale - The locale code.
     * @returns {Promise<TranslationsObject | undefined>} The translations data or null if not found.
     */
    getCachedTranslations(locale: string): Promise<TranslationsObject | undefined>;
    /**
     * Sets a new translation entry.
     * @param {string} locale - The locale code.
     * @param {string} hash - The key for the new entry.
     * @param {string} [id=hash] - The id for the new entry, defaults to key if not provided.
     * @param {any} translation - The translation value.
     * @returns {boolean} True if the entry was set successfully, false otherwise.
     */
    setTranslations(locale: string, hash: string, id: string | undefined, translation: TranslationSuccess | TranslationLoading | TranslationError): boolean;
    /**
     * Marks translations as requested for a given locale.
     * @param {string} locale - The locale code.
     */
    setTranslationRequested(locale: string): void;
    /**
     * Checks if translations have been requested for a given locale.
     * @param {string} locale - The locale code.
     * @returns {boolean} True if requested, false otherwise.
     */
    getTranslationRequested(locale: string): boolean;
}
declare const remoteTranslationsManager: RemoteTranslationsManager;
export default remoteTranslationsManager;
//# sourceMappingURL=RemoteTranslationsManager.d.ts.map