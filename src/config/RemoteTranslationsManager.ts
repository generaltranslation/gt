import { standardizeLocale } from "generaltranslation";
import { remoteTranslationsError } from "../errors/createErrors";

/**
 * Configuration type for RemoteTranslationsManager.
 */
type RemoteTranslationsConfig = {
  cacheURL: string;
  projectID: string;
};

/**
 * Manages remote translations.
 */
export class RemoteTranslationsManager {
  private config: RemoteTranslationsConfig;
  private translationsMap: Map<string, Record<string, any>>;
  private fetchPromises: Map<string, Promise<Record<string, any> | null>>;
  private requestedTranslations: Map<string, boolean>;

  /**
   * Creates an instance of RemoteTranslationsManager.
   */
  constructor() {
    this.config = {
      cacheURL: 'https://cache.gtx.dev',
      projectID: '',
    };
    this.translationsMap = new Map();
    this.fetchPromises = new Map();
    this.requestedTranslations = new Map();
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
        `${this.config.cacheURL}/${this.config.projectID}/${reference}`
      );
      const result = await response.json();
      if (Object.keys(result).length) {
        return result;
      }
    } catch (error) {
      console.error(remoteTranslationsError, error);
    }
    return null;
  }

  /**
   * Retrieves translations for a given locale.
   * @param {string} locale - The locale code.
   * @returns {Promise<Record<string, any> | null>} The translations data or null if not found.
   */
  async getTranslations(locale: string): Promise<Record<string, any> | null> {
    const reference = standardizeLocale(locale);
    if (this.translationsMap.has(reference)) {
      return this.translationsMap.get(reference) || null;
    }
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
    return true;
  }

  /**
   * Marks translations as requested for a given locale
   */
  setTranslationRequested(locale: string) {
    const reference = standardizeLocale(locale);
    this.requestedTranslations.set(reference, true);
  }

  /**
   * Checks if translations have been requested for a given locale
   */
  getTranslationRequested(locale: string): boolean {
    const reference = standardizeLocale(locale);
    return this.requestedTranslations.get(reference) ? true : false;
  }
}

const remoteTranslationsManager = new RemoteTranslationsManager();
export default remoteTranslationsManager;
