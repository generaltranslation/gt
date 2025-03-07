import { TranslationsObject, TranslationLoading, TranslationError, TranslationSuccess } from 'gt-react/internal';
/**
 * Configuration type for TranslationManager.
 * @typedef {object} TranslationManagerConfig
 * @property {string} cacheUrl - The URL of the remote cache.
 * @property {string} projectId - The project identifier for translations.
 */
export type TranslationManagerConfig = {
    cacheUrl?: string | null;
    projectId?: string;
    _versionId?: string;
    translationEnabled: boolean;
    cacheExpiryTime: number;
    loadTranslationType?: 'remote' | 'custom' | 'disabled';
};
/**
 * Manages translations
 */
export declare class TranslationManager {
    private config;
    private translationsMap;
    private translationTimestamps;
    private fetchPromises;
    private requestedTranslations;
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
     * Retrieves translations for a given locale from the remote or local cache.
     * @param {string} locale - The locale code.
     * @returns {Promise<TranslationsObject | undefined>} The translations data or undefined if not found.
     */
    getCachedTranslations(locale: string): Promise<TranslationsObject | undefined>;
    /**
     * Retrieves translations for a given locale which are already cached locally.
     * @param {string} locale - The locale code.
     * @returns {TranslationsObject | undefined} The translations data or undefined if not found.
     */
    getRecentTranslations(locale: string): TranslationsObject | undefined;
    /**
     * Sets a new translation entry.
     * @param {string} locale - The locale code.
     * @param {string} hash - The key for the new entry.
     * @param {TranslationSuccess | TranslationLoading | TranslationError} translation - The translation value.
     * @returns {boolean} True if the entry was set successfully, false otherwise.
     */
    setTranslations(locale: string, hash: string, translation: TranslationSuccess | TranslationLoading | TranslationError): boolean;
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