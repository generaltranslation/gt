import GT, { requiresTranslation } from 'generaltranslation';
import remoteTranslationsManager, {
  RemoteTranslationsManager,
} from './RemoteTranslationsManager';
import defaultInitGTProps from '../primitives/defaultInitGTProps';
import { addGTIdentifier as _addGTIdentifier, hashReactChildrenObjects, writeChildrenAsObjects } from 'gt-react/internal';

type I18NConfigurationParams = {
  apiKey: string;
  projectID: string;
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
  // Cloud integration
  baseURL: string;
  projectID: string;
  // Locale info
  defaultLocale: string;
  locales: string[] | undefined;
  // Rendering
  renderSettings: {
    method: 'skeleton' | 'replace' | 'hang' | 'subtle';
    timeout: number | null;
  };
  env: string;
  // Dictionaries
  private _remoteTranslationsManager: RemoteTranslationsManager | undefined;
  // GT
  gt: GT;
  // Other metadata
  metadata: Record<string, any>;
  // Batching config
  maxConcurrentRequests: number;
  batchInterval: number;
  private _queue: Array<any>;
  private _activeRequests: number;
  // Cache for ongoing translation requests
  private _translationCache: Map<string, Promise<any>>;
  // Processed dictionary
  private _taggedDictionary: Map<string, any>;
  private _template: Map<string, { k: string, t: any }>;

  constructor({
    // Cloud integration
    apiKey,
    projectID,
    baseURL,
    cacheURL,
    // Locale info
    defaultLocale,
    locales,
    // Render method
    renderSettings,
    // Dictionaries
    dictionary,
    // Batching config
    maxConcurrentRequests,
    batchInterval,
    // Environment
    env,
    // Other metadata
    ...metadata
  }: I18NConfigurationParams) {
    // Cloud integration
    this.projectID = projectID;
    this.baseURL = baseURL;
    // Locales
    this.defaultLocale = defaultLocale;
    this.locales = locales;
    // Render method
    this.renderSettings = renderSettings;
    // GT
    this.gt = new GT({
      projectID,
      apiKey,
      defaultLocale,
      baseURL,
    });
    // Default env is production
    this.env = env || "production";
    // Other metadata
    this.metadata = {
      env: this.env,
      defaultLocale: this.defaultLocale,
      ...(this.renderSettings.timeout && {
        timeout: this.renderSettings.timeout - batchInterval,
      }),
      ...metadata,
    };
    // Dictionary managers
    if (cacheURL && projectID) {
      this._remoteTranslationsManager = remoteTranslationsManager;
      this._remoteTranslationsManager.setConfig({
        cacheURL,
        projectID,
      });
    }
    // Cache of hashes to speed up <GTProvider>
    this._taggedDictionary = new Map();
    this._template = new Map();
    // Batching
    this.maxConcurrentRequests = maxConcurrentRequests;
    this.batchInterval = batchInterval;
    this._queue = [];
    this._activeRequests = 0;
    this._translationCache = new Map(); // cache for ongoing promises, so things aren't translated twice
    this._startBatching();
  }

  /**
   * Gets the application's default locale
   * @returns {string} A BCP-47 locale tag
   */
  getDefaultLocale(): string {
    return this.defaultLocale;
  }

  /**
   * Gets the list of approved locales for this app
   * @returns {string[] | undefined} A list of BCP-47 locale tags, or undefined if none were provided
   */
  getLocales(): string[] | undefined {
    return this.locales;
  }

  /**
   * @returns A boolean indicating whether automatic translation is enabled or disabled for this config
   */
  translationEnabled(): boolean {
    return this.baseURL &&
      this.projectID &&
      (this.baseURL === defaultInitGTProps.baseURL ? this.gt.apiKey : true)
      ? true
      : false;
  }

  /**
   * Get the rendering instructions
   * @returns An object containing the current method and timeout.
   * As of 7/31/24: method is "skeleton", "replace", "hang", "subtle".
   * Timeout is a number or null, representing no assigned timeout.
   */
  getRenderSettings(): {
    method: 'skeleton' | 'replace' | 'hang' | 'subtle';
    timeout: number | null;
  } {
    return this.renderSettings;
  }

  /**
   * Check if translation is required based on the user's locale
   * @param locale - The user's locale
   * @returns True if translation is required, otherwise false
   */
  requiresTranslation(locale: string): boolean {
    return (
      this.translationEnabled() &&
      requiresTranslation(this.defaultLocale, locale, this.locales)
    );
  }

  addGTIdentifier(children: any, id?: string): any {
    // In development, recompute every time
    if (this.env === "development" || !id) {
      return _addGTIdentifier(children, id);
    }
    // In production, since dictionary content isn't changing, cache results
    const taggedDictionaryEntry = this._taggedDictionary.get(id);
    if (taggedDictionaryEntry) {
      return taggedDictionaryEntry;
    }
    const taggedChildren = _addGTIdentifier(children, id);
    this._taggedDictionary.set(id, taggedChildren);
    return taggedChildren;
  }

  
  /**
   * @returns {[any, string]} A xxhash hash and the children that were created from it
  */
  serializeAndHash(children: any, context?: string, id?: string): [any, string] {
    // In development, recomputes hashes each time
    if (this.env === "development" || !id) {
      const childrenAsObjects = writeChildrenAsObjects(children);
      return [
        childrenAsObjects, 
        hashReactChildrenObjects(context ? [childrenAsObjects, context] : childrenAsObjects)
      ];
    }
    // In production, since dictionary content isn't changing, cache results
    const templateEntry = this._template.get(id);
    if (templateEntry) {
      return [templateEntry.t, templateEntry.k];
    } 
    const childrenAsObjects = writeChildrenAsObjects(children);
    const hash = hashReactChildrenObjects(context ? [childrenAsObjects, context] : childrenAsObjects);
    this._template.set(id, { k: hash, t: childrenAsObjects });
    return [childrenAsObjects, hash];
  }

  /**
   * Get the translation dictionaries for this user's locale, if they exist
   * Globally shared cache
   * @param locale - The locale set by the user
   * @returns A promise that resolves to the translations.
   */
  async getTranslations(locale: string): Promise<Record<string, any>> {
    return (
      (await this._remoteTranslationsManager?.getTranslations(locale)) || {}
    );
  }

  /**
   * Translate content into language associated with a given locale
   * @param params - Parameters for translation
   * @returns Translated string
   */

  async translate(params: {
    content: string | (string | { key: string; variable?: string })[];
    targetLocale: string;
    options: Record<string, any>;
  }): Promise<string> {
    
    const cacheKey = constructCacheKey(params.targetLocale, params.options);
    if (this._translationCache.has(cacheKey)) {
      return this._translationCache.get(cacheKey);
    }
    const { content, targetLocale, options } = params;
    const translationPromise = new Promise<string>((resolve, reject) => {
      this._queue.push({
        type: 'string',
        data: {
          content,
          targetLocale,
          projectID: this.projectID,
          metadata: { ...this.metadata, ...options },
        },
        revalidate: this._remoteTranslationsManager
          ? this._remoteTranslationsManager.getTranslationRequested(
              targetLocale
            )
          : false,
        resolve,
        reject,
      });
    });
    this._translationCache.set(cacheKey, translationPromise);
    return translationPromise.catch((error) => {
      this._translationCache.delete(cacheKey);
      throw new Error(error);
    });
  }

  /**
   * Translate the children components
   * @param params - Parameters for translation
   * @returns A promise that resolves when translation is complete
   */
  async translateChildren(params: {
    children: any;
    targetLocale: string;
    metadata: Record<string, any>;
  }): Promise<any> {
    const cacheKey = constructCacheKey(params.targetLocale, params.metadata);

    // In memory cache to make sure the same translation isn't requested twice
    if (this._translationCache.has(cacheKey)) {
      // Returns the previous request
      return this._translationCache.get(cacheKey);
    }

    const { children, targetLocale, metadata } = params;
    const translationPromise = new Promise<any>((resolve, reject) => {
      // In memory queue to batch requests
      this._queue.push({
        type: 'react',
        data: {
          children,
          targetLocale,
          metadata: { ...this.metadata, ...metadata },
        },
        revalidate: this._remoteTranslationsManager
          ? this._remoteTranslationsManager.getTranslationRequested(
              targetLocale
            )
          : false,
        resolve,
        reject,
      });
    });
    this._translationCache.set(cacheKey, translationPromise);
    return translationPromise;
  }

  /**
   * Send a batch request for React translation
   * @param batch - The batch of requests to be sent
   */
  private async _sendBatchRequest(batch: Array<any>): Promise<void> {
    this._activeRequests++;
    try {
      const batchPromise = this.gt.translateBatch(batch);
      batch.forEach((item) => {
        if (this._remoteTranslationsManager && !item.revalidate)
          this._remoteTranslationsManager.setTranslationRequested(
            item.data.targetLocale
          );
      });
      const results = await batchPromise;
      batch.forEach((item, index) => {
        const result = results[index];
        if (!result) return item.reject('Translation failed.');
        if (result && typeof result === 'object') {
          item.resolve(result.translation);
          if (
            result.translation &&
            result.locale &&
            result.reference &&
            this._remoteTranslationsManager
          ) {
            this._remoteTranslationsManager.setTranslations(
              result.locale,
              result.reference.key,
              result.reference.id,
              result.translation
            );
          }
        }
      });
    } catch (error) {
      console.error(error);
      batch.forEach((item) => item.reject(error));
    } finally {
      this._activeRequests--;
    }
  }

  /**
   * Start the batching process with a set interval
   */
  private _startBatching(): void {
    setInterval(() => {
      if (
        this._queue.length > 0 &&
        this._activeRequests < this.maxConcurrentRequests
      ) {
        this._sendBatchRequest(this._queue);
        this._queue = [];
      }
    }, this.batchInterval);
  }
}

// Constructs the unique identification key for the map which is the in-memory same-render-cycle cache
const constructCacheKey = (
  targetLocale: string,
  metadata: Record<string, any>
) => {
  return `${targetLocale}-${metadata.hash}`;
};
