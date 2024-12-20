import GT, { requiresTranslation } from 'generaltranslation';
import remoteTranslationsManager, {
  RemoteTranslationsManager,
} from './RemoteTranslationsManager';
import defaultInitGTProps from './props/defaultInitGTProps';
import { addGTIdentifier, hashReactChildrenObjects, writeChildrenAsObjects } from 'gt-react/internal';
import { devApiKeyIncludedInProductionError } from '../errors/createErrors';
import { TranslatedChildren } from 'gt-react/dist/types/types';

type I18NConfigurationParams = {
  apiKey?: string;
  devApiKey?: string;
  projectId: string;
  cacheUrl: string;
  baseUrl: string;
  cacheExpiryTime?: number;
  defaultLocale: string;
  locales: string[];
  renderSettings: {
    method: 'skeleton' | 'replace' | 'hang' | 'subtle';
    timeout: number | null;
  };
  maxConcurrentRequests: number;
  maxBatchSize: number;
  batchInterval: number;
  env?: string;
  [key: string]: any;
};

export default class I18NConfiguration {
  // Cloud integration
  apiKey?: string;
  devApiKey?: string;
  baseUrl: string;
  projectId: string;
  // Locale info
  defaultLocale: string;
  locales: string[];
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
  maxBatchSize: number;
  batchInterval: number;
  private _queue: Array<any>;
  private _activeRequests: number;
  // Cache for ongoing translation requests
  private _translationCache: Map<string, Promise<any>>;
  // Processed dictionary
  private _taggedDictionary: Map<string, any>;
  private _template: Map<string, { [hash: string]: TranslatedChildren }>;

  constructor({
    // Cloud integration
    apiKey,
    devApiKey,
    projectId,
    baseUrl,
    cacheUrl,
    cacheExpiryTime,
    // Locale info
    defaultLocale,
    locales,
    // Render method
    renderSettings,
    // Dictionaries
    dictionary,
    // Batching config
    maxConcurrentRequests,
    maxBatchSize,
    batchInterval,
    // Environment
    env,
    // Other metadata
    ...metadata
  }: I18NConfigurationParams) {
    // Cloud integration
    this.apiKey = apiKey;
    this.devApiKey = devApiKey;
    this.projectId = projectId;
    this.baseUrl = baseUrl;
    // Locales
    this.defaultLocale = defaultLocale;
    this.locales = locales;
    // Render method
    this.renderSettings = renderSettings;
    // GT
    this.gt = new GT({
      projectId,
      apiKey,
      sourceLocale: defaultLocale,
      baseUrl,
    });
    // Default env is production
    this.env = env || "production";
    if (this.env !== "development" && this.env !== "test" && this.devApiKey) {
      throw new Error(devApiKeyIncludedInProductionError)
    }
    // Other metadata
    this.metadata = {
      env: this.env,
      defaultLocale: this.defaultLocale,
      ...(this.renderSettings.timeout && {
        timeout: this.renderSettings.timeout - batchInterval,
      }),
      projectId: this.projectId,
      ...metadata,
    };
    // Dictionary managers
    if (cacheUrl && projectId) {
      this._remoteTranslationsManager = remoteTranslationsManager;
      this._remoteTranslationsManager.setConfig({
        cacheUrl,
        projectId,
        cacheExpiryTime
      });
    }
    // Cache of hashes to speed up <GTProvider>
    this._taggedDictionary = new Map();
    this._template = new Map();
    // Batching
    this.maxConcurrentRequests = maxConcurrentRequests;
    this.maxBatchSize = maxBatchSize;
    this.batchInterval = batchInterval;
    this._queue = [];
    this._activeRequests = 0;
    this._translationCache = new Map(); // cache for ongoing promises, so things aren't translated twice
    this._startBatching();
  }

  /**
   * Gets config for dynamic translation on the client side.
  */
  getClientSideConfig() {
    return {
      projectId: this.projectId,
      devApiKey: this.devApiKey,
      baseUrl: this.baseUrl,
      env: this.env
    }
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
   * @returns {string[]} A list of BCP-47 locale tags, or undefined if none were provided
   */
  getLocales(): string[] {
    return this.locales;
  }

  /**
   * @returns A boolean indicating whether automatic translation is enabled or disabled for this config
   */
  translationEnabled(): boolean {
    return this.baseUrl &&
      this.projectId &&
      (this.baseUrl === defaultInitGTProps.baseUrl ? this.gt.apiKey : true)
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

  /**
   * Check if the current environment is set to "development" or "test"
   * @returns True if the current environment is development
  */
  isDevelopmentEnvironment(): boolean {
    return this.env === "development" || this.env === "test";
  }

  addGTIdentifier(children: any, id?: string): any {

    // In development, recompute every time
    if (this.isDevelopmentEnvironment() || !id) {
      return addGTIdentifier(children, id);
    }
    // In production, since dictionary content isn't changing, cache results
    const taggedDictionaryEntry = this._taggedDictionary.get(id);
    if (taggedDictionaryEntry) {
      return taggedDictionaryEntry;
    }
    const taggedChildren = addGTIdentifier(children, id);
    
    this._taggedDictionary.set(id, taggedChildren);
    return taggedChildren;
  }
  
  /**
   * @returns {[any, string]} A xxhash hash and the children that were created from it
  */
  serializeAndHash(children: any, context?: string, id?: string): [any, string] {
    // In development, recomputes hashes each time
    if (this.isDevelopmentEnvironment() || !id) {
      const childrenAsObjects = writeChildrenAsObjects(children);
      return [
        childrenAsObjects, 
        hashReactChildrenObjects(context ? [childrenAsObjects, context] : childrenAsObjects)
      ];
    }
    // In production, since dictionary content isn't changing, cache results
    const templateEntry = this._template.get(id);
    if (templateEntry) {
      const [[ hash, target ]] = Object.entries(templateEntry);
      return [target, hash];
    } 
    const childrenAsObjects = writeChildrenAsObjects(children);
    const hash = hashReactChildrenObjects(context ? [childrenAsObjects, context] : childrenAsObjects);
    this._template.set(id, { [hash]: childrenAsObjects });
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

  async translateContent(params: {
    source: string | (string | { key: string; variable?: string })[];
    targetLocale: string;
    options: Record<string, any>;
  }): Promise<string> {
    
    const cacheKey = constructCacheKey(params.targetLocale, params.options);
    if (this._translationCache.has(cacheKey)) {
      return this._translationCache.get(cacheKey);
    }
    const { source, targetLocale, options } = params;
    const translationPromise = new Promise<string>((resolve, reject) => {
      this._queue.push({
        type: 'content',
        data: {
          source,
          targetLocale,
          metadata: { ...this.metadata, projectId: this.projectId, ...options },
        },
        revalidate: !this.isDevelopmentEnvironment() && (this._remoteTranslationsManager
          ? this._remoteTranslationsManager.getTranslationRequested(
              targetLocale
            )
          : false),
        resolve,
        reject,
      });
    }).catch((error) => {
      this._translationCache.delete(cacheKey);
      console.error(error);
      return '';
    });
    this._translationCache.set(cacheKey, translationPromise);
    return translationPromise;
  }

  /**
   * Translate the children components
   * @param params - Parameters for translation
   * @returns A promise that resolves when translation is complete
   */
  async translateChildren(params: {
    source: any;
    targetLocale: string;
    metadata: Record<string, any>;
  }): Promise<any> {
    const cacheKey = constructCacheKey(params.targetLocale, params.metadata);

    // In memory cache to make sure the same translation isn't requested twice
    if (this._translationCache.has(cacheKey)) {
      // Returns the previous request
      return this._translationCache.get(cacheKey);
    }

    const { source, targetLocale, metadata } = params;
    const translationPromise = new Promise<any>((resolve, reject) => {
      // In memory queue to batch requests
      this._queue.push({
        type: 'jsx',
        data: {
          source,
          targetLocale,
          metadata: { ...this.metadata, ...metadata },
        },
        revalidate: !this.isDevelopmentEnvironment() && (this._remoteTranslationsManager
          ? this._remoteTranslationsManager.getTranslationRequested(
              targetLocale
            )
          : false),
        resolve,
        reject,
      });
    }).catch((error) => {
      this._translationCache.delete(cacheKey);
      console.error(error);
      return null;
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
          if (
            'translation' in result &&
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
            return item.resolve(result.translation);
          } else if ('error' in result &&
            result.error
          ) {
            console.error(`Translation failed${result?.reference?.id ? ` for id: ${result.reference.id}` : '' }`, result);
            return item.resolve(result);
          }
        }
        return item.reject('Translation failed.');
      });
    } catch (error) {
      batch.forEach((item) => {
        item.reject()
      });
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
        const batchSize = Math.min(this.maxBatchSize, this._queue.length);
        this._sendBatchRequest(this._queue.slice(0, batchSize));
        this._queue = this._queue.slice(batchSize);
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
