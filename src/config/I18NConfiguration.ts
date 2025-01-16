import { requiresRegionalTranslation, requiresTranslation } from 'generaltranslation';
import remoteTranslationsManager, {
  RemoteTranslationsManager,
} from './RemoteTranslationsManager';
import { addGTIdentifier, writeChildrenAsObjects, RenderMethod, TranslatedChildren, isTranslationError, TranslatedContent, TranslationError } from 'gt-react/internal';
import { devApiKeyIncludedInProductionError } from '../errors/createErrors';
import { hashJsxChildren } from 'generaltranslation/id';
import { JsxChildren } from 'generaltranslation/dist/types';
import { GTTranslationError } from '../types/types';
type I18NConfigurationParams = {
  remoteCache: boolean;
  runtimeTranslation: boolean;
  apiKey?: string;
  devApiKey?: string;
  projectId: string;
  cacheUrl: string;
  runtimeUrl: string;
  cacheExpiryTime?: number;
  defaultLocale: string;
  locales: string[];
  renderSettings: {
    method: RenderMethod;
    timeout: number | null;
  };
  maxConcurrentRequests: number;
  maxBatchSize: number;
  batchInterval: number;
  [key: string]: any;
};

export default class I18NConfiguration {
  // Feature flags
  runtimeTranslation: boolean;
  remoteCache: boolean;
  // Cloud integration
  apiKey?: string;
  devApiKey?: string;
  runtimeUrl: string;
  projectId: string;
  // Locale info
  defaultLocale: string;
  locales: string[];
  // Rendering
  renderSettings: {
    method: RenderMethod;
    timeout: number | null;
  };
  // Dictionaries
  private _remoteTranslationsManager: RemoteTranslationsManager | undefined;
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
    runtimeTranslation,
    remoteCache,
    apiKey,
    devApiKey,
    projectId,
    runtimeUrl,
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
    // Other metadata
    ...metadata
  }: I18NConfigurationParams) {
    // Feature flags
    this.runtimeTranslation = runtimeTranslation;
    this.remoteCache = remoteCache;
    // Cloud integration
    this.apiKey = apiKey;
    this.devApiKey = devApiKey;
    this.projectId = projectId;
    this.runtimeUrl = runtimeUrl;
    // Locales
    this.defaultLocale = defaultLocale;
    this.locales = locales;
    // Render method
    this.renderSettings = renderSettings;
    // Default env is production
    if (
      process.env.NODE_ENV !== 'development' &&
      process.env.NODE_ENV !== 'test' &&
      this.devApiKey
    ) {
      throw new Error(devApiKeyIncludedInProductionError);
    }
    // Other metadata
    this.metadata = {
      sourceLocale: this.defaultLocale,
      ...(this.renderSettings.timeout && {
        timeout: this.renderSettings.timeout - batchInterval,
      }),
      projectId: this.projectId,
      publish: true,
      fast: true,
      ...metadata,
    };
    // Dictionary managers
    if (cacheUrl && projectId) {
      this._remoteTranslationsManager = remoteTranslationsManager;
      this._remoteTranslationsManager.setConfig({
        cacheUrl,
        projectId,
        cacheExpiryTime,
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
      runtimeUrl: this.runtimeUrl,
    };
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
    return this.runtimeTranslation &&
      this.projectId &&
      this.runtimeUrl &&
      (this.apiKey || this.devApiKey)
      ? true
      : false;
  }

  /**
   * Get the rendering instructions
   * @returns An object containing the current method and timeout.
   * As of 1/14/25: method is "skeleton", "replace", "hang", "subtle", "default".
   * Timeout is a number or null, representing no assigned timeout.
   */
  getRenderSettings(): {
    method: RenderMethod;
    timeout: number | null;
  } {
    return this.renderSettings;
  }

  /**
   * Checks if regional translation is required (ie en-US -> en-GB)
   * @param locale - The user's locale
   * @returns True if a regional translation is required, otherwise false
   */
  requiresRegionalTranslation(locale: string): boolean {
    return (
      this.translationEnabled() &&
      requiresRegionalTranslation(this.defaultLocale, locale, this.locales)
    );
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
    return addGTIdentifier(children, id);
  }

  /**
   * @returns {[any, string]} A xxhash hash and the children that were created from it
   */
  serializeAndHash(
    children: any,
    context?: string,
    id?: string
  ): [any, string] {
    const childrenAsObjects = writeChildrenAsObjects(children);
    return [
      childrenAsObjects,
      hashJsxChildren(
        context
          ? { source: childrenAsObjects as unknown as JsxChildren, context }
          : { source: childrenAsObjects as unknown as JsxChildren }
      ),
    ];
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
  }): Promise<TranslatedContent> {
    const cacheKey = constructCacheKey(params.targetLocale, params.options);
    if (this._translationCache.has(cacheKey)) {
      return this._translationCache.get(cacheKey);
    }
    const { source, targetLocale, options } = params;
    const translationPromise = new Promise<TranslatedContent>((resolve, reject) => {
      this._queue.push({
        type: 'content',
        source,
        targetLocale,
        metadata: options,
        resolve,
        reject,
      });
    }).catch((error) => {
      this._translationCache.delete(cacheKey);
      throw new Error(error);
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
  }): Promise<TranslatedChildren> {
    const cacheKey = constructCacheKey(params.targetLocale, params.metadata);

    // In memory cache to make sure the same translation isn't requested twice
    if (this._translationCache.has(cacheKey)) {
      // Returns the previous request
      return this._translationCache.get(cacheKey);
    }

    const { source, targetLocale, metadata } = params;
    const translationPromise = new Promise<TranslatedChildren>((resolve, reject) => {
      // In memory queue to batch requests
      this._queue.push({
        type: 'jsx',
        source,
        targetLocale,
        metadata,
        resolve,
        reject,
      });
    }).catch((error) => {
      console.error(error);
      this._translationCache.delete(cacheKey);
      throw new Error(error);
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
      const response = await fetch(
        `${this.runtimeUrl}/v1/runtime/${this.projectId}/server`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(this.apiKey && { 'x-gt-api-key': this.apiKey }),
            ...(this.devApiKey && { 'x-gt-dev-api-key': this.devApiKey }),
          },
          body: JSON.stringify({
            requests: batch.map((item) => {
              const { source, metadata, type } = item;
              return { source, metadata, type };
            }),
            targetLocale: batch[0].targetLocale,
            metadata: this.metadata,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const results = await response.json();

      batch.forEach((item, index) => {
        // check if entry is missing
        const result = results[index];
        if (!result) return item.reject(new GTTranslationError('Translation failed.', 500));
        if (result && typeof result === 'object') {
          if ('translation' in result) {
            if (this._remoteTranslationsManager) {
              this._remoteTranslationsManager.setTranslations(
                result.locale,
                result.reference.key,
                result.reference.id,
                result.translation
              );
            }
            return item.resolve(result.translation);
          } else if ('error' in result && result.error) {
            return item.reject(new GTTranslationError('Translation failed.', 500));
          }
        }
        return item.reject(new GTTranslationError('Translation failed.', 500));
      });
    } catch (error) {
      console.error(error);
      batch.forEach((item) => {
        return item.reject(new GTTranslationError('Translation failed.', 500));
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
