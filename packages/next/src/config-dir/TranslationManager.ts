import defaultWithGTConfigProps from './props/defaultWithGTConfigProps';
import { defaultCacheUrl } from 'generaltranslation/internal';
import {
  TranslationsObject,
  TranslationLoading,
  TranslationError,
  TranslationSuccess,
} from 'gt-react/internal';
import loadTranslations from './loadTranslation';

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
  loadTranslationsType?: 'remote' | 'custom' | 'disabled';
};

/**
 * Manages translations
 */
export class TranslationManager {
  private config: TranslationManagerConfig;
  private translationsMap: Map<string, TranslationsObject>;
  private translationTimestamps: Map<string, number>;
  private fetchPromises: Map<string, Promise<TranslationsObject | undefined>>;
  private requestedTranslations: Map<string, boolean>;
  private gtServicesEnabled: boolean;
  /**
   * Creates an instance of TranslationManager.
   * @constructor
   */
  constructor() {
    this.config = {
      cacheUrl: defaultCacheUrl,
      projectId: '',
      _versionId: undefined,
      translationEnabled: true,
      cacheExpiryTime: defaultWithGTConfigProps.cacheExpiryTime,
    };
    this.translationsMap = new Map();
    this.translationTimestamps = new Map();
    this.fetchPromises = new Map();
    this.requestedTranslations = new Map();
    this.gtServicesEnabled =
      process.env._GENERALTRANSLATION_GT_SERVICES_ENABLED === 'true';
  }

  /**
   * Sets the configuration for the TranslationManager.
   * @param {Partial<TranslationManagerConfig>} newConfig - The new configuration to apply.
   */
  setConfig(newConfig: Partial<TranslationManagerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Fetches translations from the remote cache.
   * @param {string} reference - The translation reference.
   * @returns {Promise<TranslationsObject | undefined>} The fetched translations or undefined if not found.
   */
  private async _fetchTranslations(
    reference: string
  ): Promise<TranslationsObject | undefined> {
    if (!this.config.translationEnabled) return undefined;
    const result = await loadTranslations({
      targetLocale: reference,
      ...(this.config._versionId && { _versionId: this.config._versionId }),
      ...(this.config.cacheUrl && { cacheUrl: this.config.cacheUrl }),
      ...(this.config.projectId && { projectId: this.config.projectId }),
    });
    return result;
  }

  /**
   * Retrieves translations for a given locale from the remote or local cache.
   * @param {string} locale - The locale code.
   * @returns {Promise<TranslationsObject | undefined>} The translations data or undefined if not found.
   */
  async getCachedTranslations(
    locale: string
  ): Promise<TranslationsObject | undefined> {
    // Check if translations have expired
    // Translations can only expire if they are loaded remotely
    const hasExpired =
      this.config.loadTranslationsType === 'remote' &&
      this.translationsMap.has(locale) &&
      Date.now() - (this.translationTimestamps.get(locale) ?? 0) >
        this.config.cacheExpiryTime;

    // Return cached translations if available
    if (this.translationsMap.has(locale) && !hasExpired) {
      return this.translationsMap.get(locale);
    }

    // Await any in-progress fetch
    if (this.fetchPromises.has(locale)) {
      return await this.fetchPromises.get(locale);
    }

    // Fetch translations
    const fetchPromise = this._fetchTranslations(locale);
    this.fetchPromises.set(locale, fetchPromise);
    const retrievedTranslations = await fetchPromise;
    this.fetchPromises.delete(locale);

    // Cache the retrieved translations
    if (retrievedTranslations) {
      this.translationsMap.set(locale, retrievedTranslations);
      this.translationTimestamps.set(locale, Date.now());
    }
    return retrievedTranslations;
  }

  /**
   * Retrieves translations for a given locale which are already cached locally.
   * @param {string} locale - The locale code.
   * @returns {TranslationsObject | undefined} The translations data or undefined if not found.
   */
  getRecentTranslations(locale: string): TranslationsObject | undefined {
    return this.translationsMap.get(locale);
  }

  /**
   * Sets a new translation entry.
   * @param {string} locale - The locale code.
   * @param {string} hash - The key for the new entry.
   * @param {TranslationSuccess | TranslationLoading | TranslationError} translation - The translation value.
   * @returns {boolean} True if the entry was set successfully, false otherwise.
   */
  setTranslations(
    locale: string,
    hash: string,
    translation: TranslationSuccess | TranslationLoading | TranslationError
  ): boolean {
    if (!(locale && hash && translation)) return false;
    const currentTranslations = this.translationsMap.get(locale) || {};
    this.translationsMap.set(locale, {
      ...currentTranslations,
      [hash]: translation,
    });
    return true;
  }

  /**
   * Marks translations as requested for a given locale.
   * @param {string} locale - The locale code.
   */
  setTranslationRequested(locale: string): void {
    this.requestedTranslations.set(locale, true);
  }

  /**
   * Checks if translations have been requested for a given locale.
   * @param {string} locale - The locale code.
   * @returns {boolean} True if requested, false otherwise.
   */
  getTranslationRequested(locale: string): boolean {
    return this.requestedTranslations.get(locale) ? true : false;
  }
}

const translationManager = new TranslationManager();
export default translationManager;
