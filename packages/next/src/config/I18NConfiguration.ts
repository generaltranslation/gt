import { requiresTranslation } from 'generaltranslation';
import remoteTranslationsManager, {
  RemoteTranslationsManager,
} from './RemoteTranslationsManager';
import {
  addGTIdentifier,
  writeChildrenAsObjects,
  RenderMethod,
  TranslatedChildren,
  TranslatedContent,
  Children,
  defaultRenderSettings,
  GTTranslationError,
} from 'gt-react/internal';
import {
  createMismatchingHashWarning,
  devApiKeyIncludedInProductionError,
} from '../errors/createErrors';
import { hashJsxChildren } from 'generaltranslation/id';
import { Content, JsxChildren } from 'generaltranslation/internal';
import { TaggedChildren, TranslationsObject } from 'gt-react/internal';
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
    timeout?: number;
  };
  maxConcurrentRequests: number;
  maxBatchSize: number;
  batchInterval: number;
  [key: string]: any;
};

type QueueEntry =
  | {
      type: 'content';
      source: Content;
      targetLocale: string;
      metadata: { hash: string } & Record<string, any>;
      resolve: (
        value: TranslatedContent | PromiseLike<TranslatedContent>
      ) => void;
      reject: (reason?: any) => void;
    }
  | {
      type: 'jsx';
      source: JsxChildren;
      targetLocale: string;
      metadata: { hash: string } & Record<string, any>;
      resolve: (
        value: TranslatedChildren | PromiseLike<TranslatedChildren>
      ) => void;
      reject: (reason?: any) => void;
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
  _versionId?: string;
  // Locale info
  defaultLocale: string;
  locales: string[];
  // Rendering
  renderSettings: {
    method: RenderMethod;
    timeout?: number;
  };
  // Dictionaries
  private _remoteTranslationsManager: RemoteTranslationsManager | undefined;
  // Other metadata
  metadata: Record<string, any>;
  // Batching config
  maxConcurrentRequests: number;
  maxBatchSize: number;
  batchInterval: number;
  private _queue: Array<QueueEntry>;
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
    _versionId,
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
    this._versionId = _versionId; // version id for the dictionary
    // Locales
    this.defaultLocale = defaultLocale;
    this.locales = locales;
    // Default env is production
    if (
      process.env.NODE_ENV !== 'development' &&
      process.env.NODE_ENV !== 'test' &&
      this.devApiKey
    ) {
      throw new Error(devApiKeyIncludedInProductionError);
    }
    // Render method
    this.renderSettings = {
      method: renderSettings.method,
      ...((renderSettings.timeout !== undefined ||
        defaultRenderSettings.timeout !== undefined) && {
        timeout: renderSettings.timeout || defaultRenderSettings.timeout,
      }),
    };
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
        _versionId,
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
      runtimeTranslations: this.runtimeTranslation,
    };
  }

  /**
   * Runtime translation is enabled only in development with a devApiKey for <TX> components
   * @returns {boolean} A boolean indicating whether the dev runtime translation is enabled
   */
  isRuntimeTranslationEnabled(): boolean {
    return this.translationEnabled() && !!this.devApiKey;
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
    return this.projectId && this.runtimeUrl && (this.apiKey || this.devApiKey)
      ? true
      : false;
  }

  /**
   * Get the rendering instructions
   * @returns An object containing the current method and timeout.
   * As of 1/22/25: method is "skeleton", "replace", "default".
   * Timeout is a number or null, representing no assigned timeout.
   */
  getRenderSettings(): {
    method: RenderMethod;
    timeout?: number;
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

  addGTIdentifier(children: Children): TaggedChildren {
    return addGTIdentifier(children);
  }

  /**
   * @param {TaggedChildren} children - The children to be serialized
   * @param {string} context - The context in which the children are being serialized
   * @returns {[JsxChildren, string]} Serialized children and SHA256 hash generated from it
   */
  serializeAndHashChildren(
    children: TaggedChildren,
    context?: string
  ): [JsxChildren, string] {
    const childrenAsObjects = writeChildrenAsObjects(children);
    return [
      childrenAsObjects,
      hashJsxChildren({
        source: childrenAsObjects,
        ...(context && { context }),
      }),
    ];
  }

  /**
   * @param {Content} content - The content to be hashed
   * @param {string} context - The context in which the content are being hashed
   * @returns {string} A SHA256 hash of the content
   */
  hashContent(content: Content, context?: string): string {
    return hashJsxChildren({
      source: content,
      ...(context && { context }),
    });
  }

  /**
   * Get the translation dictionaries for this user's locale, if they exist
   * Globally shared cache or saved locally
   * @param locale - The locale set by the user
   * @returns A promise that resolves to the translations.
   */
  async getCachedTranslations(locale: string): Promise<TranslationsObject> {
    return (
      (await this._remoteTranslationsManager?.getCachedTranslations(locale)) ||
      {}
    );
  }

  /**
   * Translate content into language associated with a given locale
   * @param params - Parameters for translation
   * @returns Translated string
   */
  async translateContent(params: {
    source: Content;
    targetLocale: string;
    options: { hash: string } & Record<string, any>;
  }): Promise<TranslatedContent> {
    // check internal cache
    const cacheKey = constructCacheKey(params.targetLocale, params.options);
    if (this._translationCache.has(cacheKey)) {
      return this._translationCache.get(cacheKey);
    }
    // add to tx queue
    const { source, targetLocale, options } = params;
    const translationPromise = new Promise<TranslatedContent>(
      (resolve, reject) => {
        this._queue.push({
          type: 'content',
          source,
          targetLocale,
          metadata: options,
          resolve,
          reject,
        });
      }
    ).catch((error) => {
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
    source: JsxChildren;
    targetLocale: string;
    metadata: { hash: string } & Record<string, any>;
  }): Promise<TranslatedChildren> {
    // In memory cache to make sure the same translation isn't requested twice
    const { source, targetLocale, metadata } = params;
    const cacheKey = constructCacheKey(targetLocale, metadata);
    if (this._translationCache.has(cacheKey)) {
      return this._translationCache.get(cacheKey);
    }

    // Add to translation queue
    const translationPromise = new Promise<TranslatedChildren>(
      (resolve, reject) => {
        // In memory queue to batch requests
        this._queue.push({
          type: 'jsx',
          source,
          targetLocale,
          metadata,
          resolve,
          reject,
        });
      }
    ).catch((error) => {
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
  private async _sendBatchRequest(batch: Array<QueueEntry>): Promise<void> {
    this._activeRequests++;
    try {
      // ----- TRANSLATION REQUEST WITH ABORT CONTROLLER ----- //
      const fetchWithAbort = async (
        url: string,
        options: RequestInit | undefined,
        timeout: number | undefined
      ) => {
        const controller = new AbortController();
        const timeoutId =
          timeout === undefined
            ? undefined
            : setTimeout(() => controller.abort(), timeout);
        try {
          return await fetch(url, { ...options, signal: controller.signal });
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError')
            throw new Error('Request timed out'); // Handle the timeout case
          throw error; // Re-throw other errors
        } finally {
          if (timeoutId !== undefined) clearTimeout(timeoutId); // Ensure timeout is cleared
        }
      };

      const response = await fetchWithAbort(
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
            versionId: this._versionId,
          }),
        },
        this.renderSettings.timeout // Pass the timeout duration in milliseconds
      );

      // ----- PROCESS RESPONSE ----- //

      if (!response.ok) {
        throw new Error(await response.text());
      }
      const results = await response.json();
      batch.forEach((request, index) => {
        // check if entry is missing
        const result = results[index];

        let errorMsg = 'Translation failed.';
        let errorCode = 500;
        if (!result)
          return request.reject(new GTTranslationError(errorMsg, errorCode));

        const key = request.metadata.id || request.metadata.hash;
        if (result && typeof result === 'object') {
          if ('translation' in result && result.translation) {
            // record translations
            if (this._remoteTranslationsManager) {
              this._remoteTranslationsManager.setTranslations(
                request.targetLocale,
                request.metadata.hash,
                key,
                {
                  state: 'success',
                  target: result.translation,
                  hash: result.reference.key,
                }
              );
            }
            // check for mismatching ids or hashes
            if (result.reference.key !== request.metadata.hash) {
              console.warn(
                createMismatchingHashWarning(
                  request.metadata.hash,
                  result.reference.key
                )
              );
            }
            return request.resolve(result.translation);
          } else if ('error' in result && result.error) {
            errorMsg = result.error || errorMsg;
            errorCode = result.code || errorCode;
          }
        }
        // record translation error
        if (this._remoteTranslationsManager) {
          this._remoteTranslationsManager.setTranslations(
            request.targetLocale,
            request.metadata.hash,
            key,
            {
              state: 'error',
              error: result.error || 'Translation failed.',
              code: result.code || 500,
            }
          );
        }
        return request.reject(new GTTranslationError(errorMsg, errorCode));
      });
    } catch (error) {
      console.error(error);
      batch.forEach((request) => {
        // record translation error
        if (this._remoteTranslationsManager) {
          this._remoteTranslationsManager.setTranslations(
            request.targetLocale,
            request.metadata.hash,
            request.metadata.id || request.metadata.hash,
            { state: 'error', error: 'Translation failed.', code: 500 }
          );
        }
        return request.reject(
          new GTTranslationError('Translation failed.', 500)
        );
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
