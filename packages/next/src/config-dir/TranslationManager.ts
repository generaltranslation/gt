import { standardizeLocale } from 'generaltranslation';
import defaultWithGTConfigProps from './props/defaultWithGTConfigProps';
import { defaultCacheUrl } from 'generaltranslation/internal';
import { TranslatedChildren, Translations } from 'gt-react/internal';
import loadTranslations from './loadTranslation';
import { TranslationsStatus } from 'gt-react/internal';

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
  private translationsMap: Map<string, Translations>;
  private translationsStatusMap: Map<string, TranslationsStatus>;
  private translationTimestamps: Map<string, number>;
  private fetchPromises: Map<string, Promise<Translations | undefined>>;
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
    this.translationsStatusMap = new Map();
    this.translationTimestamps = new Map();
    this.fetchPromises = new Map();
    this.gtServicesEnabled =
      process.env._GENERALTRANSLATION_GT_SERVICES_ENABLED === 'true';
  }

  /**
   * Standardizes a locale if GT services are enabled.
   * @param {string} locale - The locale to standardize.
   * @returns {string} The standardized locale.
   */
  _standardizeLocale(locale: string): string {
    return this.gtServicesEnabled ? standardizeLocale(locale) : locale;
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
   * @returns {Promise<Translations | undefined>} The fetched translations or undefined if not found.
   */
  private async _fetchTranslations(
    reference: string
  ): Promise<Translations | undefined> {
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
   * @returns {Promise<Translations | undefined>} The translations data or undefined if not found.
   */
  async getCachedTranslations(
    locale: string
  ): Promise<Translations | undefined> {
    const reference = this._standardizeLocale(locale);

    // Check if translations have expired
    // Translations can only expire if they are loaded remotely
    const hasExpired =
      this.config.loadTranslationsType === 'remote' &&
      this.translationsMap.has(reference) &&
      Date.now() - (this.translationTimestamps.get(reference) ?? 0) >
        this.config.cacheExpiryTime;

    // Return cached translations if available
    if (this.translationsMap.has(reference) && !hasExpired) {
      return this.translationsMap.get(reference);
    }
    // Await any in-progress fetch
    if (this.fetchPromises.has(reference)) {
      return await this.fetchPromises.get(reference);
    }
    // Fetch translations remotely
    const fetchPromise = this._fetchTranslations(reference);
    this.fetchPromises.set(reference, fetchPromise);
    const retrievedTranslations = await fetchPromise;
    this.fetchPromises.delete(reference);

    if (retrievedTranslations) {
      // Update the translation result status
      Object.keys(retrievedTranslations).forEach((hash) => {
        this.translationsStatusMap.set(reference, {
          ...(this.translationsStatusMap.get(reference) || {}),
          [hash]: { status: 'success' },
        });
      });

      // Cache the retrieved translations
      this.translationsMap.set(reference, retrievedTranslations);
      this.translationTimestamps.set(reference, Date.now());
    }
    return retrievedTranslations;
  }

  /**
   * Get the translation result status for a given locale
   * @param locale - The locale set by the user
   * @returns The translation result status.
   */
  getCachedTranslationsStatus(locale: string): TranslationsStatus {
    const reference = this._standardizeLocale(locale);
    return this.translationsStatusMap.get(reference) || {};
  }

  /**
   * Retrieves translations for a given locale which are already cached locally.
   * @param {string} locale - The locale code.
   * @returns {Translations | undefined} The translations data or undefined if not found.
   */
  getRecentTranslations(locale: string): Translations | undefined {
    const reference = this._standardizeLocale(locale);
    return this.translationsMap.get(reference);
  }

  /**
   * Sets a new translation entry.
   * @param {string} locale - The locale code.
   * @param {string} hash - The key for the new entry.
   * @param {TranslatedChildren} translation - The translation value.
   */
  setTranslations(
    locale: string,
    hash: string,
    translation: TranslatedChildren
  ) {
    if (!(locale && hash && translation)) return false;
    const reference = this._standardizeLocale(locale);
    this.translationsMap.set(reference, {
      ...(this.translationsMap.get(reference) || {}),
      [hash]: translation,
    });
  }

  /**
   * Sets a new translation success entry.
   * @param {string} locale - The locale code.
   * @param {string} hash - The key for the new entry.
   * @returns {boolean} True if the entry was set successfully, false otherwise.
   */
  setTranslationsSuccess(locale: string, hash: string) {
    if (!(locale && hash)) return false;
    const reference = this._standardizeLocale(locale);
    this.translationsStatusMap.set(reference, {
      ...(this.translationsStatusMap.get(reference) || {}),
      [hash]: {
        status: 'success',
      },
    });
  }

  /**
   * Sets a new translation error entry.
   * @param {string} locale - The locale code.
   * @param {string} hash - The key for the new entry.
   * @param {string} error - The error message.
   * @param {number} code - The error code.
   */
  setTranslationError(
    locale: string,
    hash: string,
    error?: string,
    code?: number
  ) {
    if (!(locale && hash)) return;
    const reference = this._standardizeLocale(locale);
    this.translationsStatusMap.set(reference, {
      ...(this.translationsStatusMap.get(reference) || {}),
      [hash]: { status: 'error', error, code },
    });
  }

  setTranslationsLoading(locale: string, hash: string) {
    if (!(locale && hash)) return;
    const reference = this._standardizeLocale(locale);
    this.translationsStatusMap.set(reference, {
      ...(this.translationsStatusMap.get(reference) || {}),
      [hash]: { status: 'loading' },
    });
  }
}

const translationManager = new TranslationManager();
export default translationManager;
