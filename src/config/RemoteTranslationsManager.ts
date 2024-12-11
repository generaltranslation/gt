import { standardizeLocale } from "generaltranslation";
import { remoteTranslationsError } from "../errors/createErrors";
import defaultInitGTProps from "./props/defaultInitGTProps";

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
export class RemoteTranslationsManager {
  private config: RemoteTranslationsConfig;
  private translationsMap: Map<string, Record<string, any>>;
  private fetchPromises: Map<string, Promise<Record<string, any> | null>>;
  private requestedTranslations: Map<string, boolean>;
  private lastFetchTime: Map<string, number>;

  /**
   * Creates an instance of RemoteTranslationsManager.
   * @constructor
   */
  constructor() {
    this.config = {
      cacheUrl: 'https://cache.gtx.dev',
      projectId: '',
      cacheExpiryTime: defaultInitGTProps.cacheExpiryTime, // default to 60 seconds
    };
    this.translationsMap = new Map();
    this.fetchPromises = new Map();
    this.requestedTranslations = new Map();
    this.lastFetchTime = new Map();
  }

  /**
   * Sets the configuration for the RemoteTranslationsManager.
   * @param {Partial<RemoteTranslationsConfig>} newConfig - The new configuration to apply.
   */
  setConfig(newConfig: Partial<RemoteTranslationsConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Fetches translations from the remote cache.
   * @param {string} reference - The translation reference.
   * @returns {Promise<Record<string, any> | null>} The fetched translations or null if not found.
   */
  private async _fetchTranslations(
    reference: string
  ): Promise<Record<string, any> | null> {
    try {
      const response = await fetch(
        `${this.config.cacheUrl}/${this.config.projectId}/${reference}`
      );
      const result = await response.json();
      if (Object.keys(result).length) {
        this.lastFetchTime.set(reference, Date.now());
        return result;
      }
    } catch (error) {
      console.error(remoteTranslationsError, error);
    }
    return null;
  }

  /**
   * Checks if translations are expired based on the configured TTL.
   * @param {string} reference - The translation reference.
   * @returns {boolean} True if expired, false otherwise.
   */
  private _isExpired(reference: string): boolean {
    const fetchTime = this.lastFetchTime.get(reference);
    if (!fetchTime) return true;
    const now = Date.now();
    const expiryTime = this.config.cacheExpiryTime ?? defaultInitGTProps.cacheExpiryTime;
    return now - fetchTime > expiryTime;
  }

  /**
   * Retrieves translations for a given locale.
   * @param {string} locale - The locale code.
   * @returns {Promise<Record<string, any> | null>} The translations data or null if not found.
   */
  async getTranslations(locale: string): Promise<Record<string, any> | null> {
    const reference = standardizeLocale(locale);

    // If we have cached translations and they are not expired, return them
    if (this.translationsMap.has(reference) && !this._isExpired(reference)) {
      return this.translationsMap.get(reference) || null;
    }

    // If we have a fetch in progress, await that
    if (this.fetchPromises.has(reference)) {
      return (await this.fetchPromises.get(reference)) || null;
    }

    const fetchPromise = this._fetchTranslations(reference);
    this.fetchPromises.set(reference, fetchPromise);

    const retrievedTranslations = await fetchPromise;
    this.fetchPromises.delete(reference);

    if (retrievedTranslations) {
      this.translationsMap.set(reference, retrievedTranslations);
    }
    return retrievedTranslations;
  }

  /**
   * Sets a new translation entry.
   * @param {string} locale - The locale code.
   * @param {string} key - The key for the new entry.
   * @param {string} [id=key] - The id for the new entry, defaults to key if not provided.
   * @param {any} translation - The translation value.
   * @returns {boolean} True if the entry was set successfully, false otherwise.
   */
  setTranslations(
    locale: string,
    key: string,
    id: string = key,
    translation: any
  ): boolean {
    if (!(locale && key && id && translation)) return false;
    const reference = standardizeLocale(locale);
    const currentTranslations = this.translationsMap.get(reference) || {};
    this.translationsMap.set(reference, {
      ...currentTranslations,
      [id]:
        translation && typeof translation === 'object' && translation.t
          ? { ...translation, k: key }
          : { k: key, t: translation },
    });
    // Reset the fetch time since we just manually updated the translation
    this.lastFetchTime.set(reference, Date.now());
    return true;
  }

  /**
   * Marks translations as requested for a given locale.
   * @param {string} locale - The locale code.
   */
  setTranslationRequested(locale: string): void {
    const reference = standardizeLocale(locale);
    this.requestedTranslations.set(reference, true);
  }

  /**
   * Checks if translations have been requested for a given locale.
   * @param {string} locale - The locale code.
   * @returns {boolean} True if requested, false otherwise.
   */
  getTranslationRequested(locale: string): boolean {
    const reference = standardizeLocale(locale);
    return this.requestedTranslations.get(reference) ? true : false;
  }
}

const remoteTranslationsManager = new RemoteTranslationsManager();
export default remoteTranslationsManager;
