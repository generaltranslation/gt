import { TranslationsObject, TranslationLoading, TranslationError, TranslationSuccess } from 'gt-react/internal';
/**
 * Configuration type for TranslationManager.
 * @typedef {object} TranslationManagerConfig
 * @property {string} cacheUrl - The URL of the remote cache.
 * @property {string} projectId - The project identifier for translations.
 * @property {number} [cacheExpiryTime=60000] - The cache expiration time in milliseconds.
 */
export type TranslationManagerConfig = {
    cacheUrl?: string | null;
    projectId?: string;
    cacheExpiryTime?: number;
    _versionId?: string;
    loadTranslationEnabled: boolean;
};
/**
 * Manages remote translations.
 */
export declare class TranslationManager {
    private config;
    private translationsMap;
    private fetchPromises;
    private requestedTranslations;
    private lastFetchTime;
    /**
     * Creates an instance of TranslationManager.
     * @constructor
     */
    constructor();
    /**
     * Sets the configuration for the TranslationManager.
     * @param {Partial<TranslationManagerConfig>} newConfig - The new configuration to apply.
     */
    setConfig(newConfig: Partial<TranslationManagerConfig>): void;
    /**
     * Fetches translations from the remote cache.
     * @param {string} reference - The translation reference.
     * @returns {Promise<TranslationsObject | undefined>} The fetched translations or undefined if not found.
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
     * @param {boolean} [isRuntimeTranslation=true] - Whether the translation was a runtime translation.
     * @returns {boolean} True if the entry was set successfully, false otherwise.
     */
    setTranslations(locale: string, hash: string, id: string | undefined, translation: TranslationSuccess | TranslationLoading | TranslationError, isRuntimeTranslation?: boolean): boolean;
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
declare const translationManager: TranslationManager;
export default translationManager;
//# sourceMappingURL=TranslationManager.d.ts.map