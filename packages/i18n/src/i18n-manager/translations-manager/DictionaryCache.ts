import type { LookupOptions } from '../../translation-functions/types/options';
import { Cache } from './Cache';
import type { LifecycleParam } from '../lifecycle-hooks/types';
import type {
  Content,
  EntryMetadata,
  TranslateManyEntry,
  TranslationResult,
} from 'generaltranslation/types';
import type { TranslateMany } from './TranslationsCache';

// See gt-next
const MAX_BATCH_SIZE = 25;
const MAX_CONCURRENT_REQUESTS = 100;
const BATCH_INTERVAL = 50;

/**
 * A dictionary is a nested object with strings as leaf values
 */
export type Dictionary = {
  [key: string]: DictionaryValue;
};

/**
 * Value returned from a dictionary lookup
 */
export type DictionaryValue = string | Dictionary;

/**
 * Just a way to be more explicit about what "dictionary path" is
 */
export type DictionaryPath = string;

/**
 * InputKey type for lookups
 * @typedef {Object} DictionaryKey
 * @property {DictionaryPath} id - The dictionary path
 * @property {string} message - The message from the source dictionary
 * @property {LookupOptions} options - The options for the translation
 */
export type DictionaryKey = {
  id: DictionaryPath;
  message: string;
  options: LookupOptions;
};

/**
 * A queue entry for batching, used to also handle reject and resolve
 */
type QueueEntry = {
  key: DictionaryPath;
  source: string;
  metadata: EntryMetadata;
  resolve: (value: string) => void;
  reject: (reason?: unknown) => void;
};

/**
 * A cache for a single locale's dictionary
 *
 * Principles:
 * - This class is language agnostic, and should never store the locale code as a parameter.
 *   Locale logic is handled at the LocalesDictionaryCache level. Use a callback function
 *   that has the locale parameter embedded if you wish to use the locale code.
 */
export class DictionaryCache extends Cache<
  DictionaryKey,
  DictionaryPath,
  DictionaryValue,
  DictionaryValue
> {
  /**
   * Queue of translation requests
   */
  private _queue: Array<QueueEntry> = [];

  /**
   * Timer for batching
   */
  // eslint-disable-next-line no-undef
  private _batchTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Number of active requests
   */
  private _activeRequests = 0;

  /**
   * Translate many function
   */
  private _translateMany: TranslateMany;

  /**
   * Promise cache for inflight fallbacks
   */
  private _fallbackPromises: Partial<
    Record<DictionaryPath, Promise<DictionaryValue>>
  > = {};

  /**
   * Constructor
   * @param {Object} params - The parameters for the cache
   * @param {Dictionary} params.init - The initial cache
   * @param {Function} params.fallback - Get the fallback value for a cache miss
   */
  constructor({
    init,
    translateMany,
    lifecycle,
  }: {
    init: Dictionary;
    translateMany: TranslateMany;
    lifecycle?: LifecycleParam<
      DictionaryKey,
      DictionaryPath,
      DictionaryValue,
      DictionaryValue
    >;
  }) {
    super(init, lifecycle);
    this._translateMany = translateMany;
  }

  /**
   * Get the dictionary value for a given key
   * @param key - The dictionary key
   * @returns The dictionary value
   */
  public get<T extends DictionaryValue>(key: DictionaryKey): T | undefined {
    const value = this.getCache(key) as T | undefined;
    if (value != null && this.onHit) {
      this.onHit({
        inputKey: key,
        cacheKey: this.genKey(key),
        cacheValue: value,
        outputValue: value,
      });
    }
    return value;
  }

  /**
   * Miss the cache
   * @param key - The dictionary key
   * @returns The dictionary value
   */
  public async miss(key: DictionaryKey): Promise<string | undefined> {
    const cacheKey = this.genKey(key);
    if (this._fallbackPromises[cacheKey] !== undefined) {
      return (await this._fallbackPromises[cacheKey]) as string | undefined;
    }

    const fallbackPromise = this.fallback(key);
    this._fallbackPromises[cacheKey] = fallbackPromise;

    try {
      const value = await fallbackPromise;
      this.setCache(cacheKey, value);
      if (value != null && this.onMiss) {
        this.onMiss({
          inputKey: key,
          cacheKey,
          cacheValue: value,
          outputValue: value,
        });
      }
      return value as string | undefined;
    } finally {
      delete this._fallbackPromises[cacheKey];
    }
  }

  /**
   * Set the value for a key
   */
  protected setCache(cacheKey: DictionaryPath, value: DictionaryValue): void {
    const cache = this.getInternalCache() as Dictionary;
    const dictionaryPath = getDictionaryPath(cacheKey);

    if (dictionaryPath.length === 0) {
      if (typeof value !== 'string') {
        replaceDictionary(cache, value);
      }
      return;
    }

    let current = cache;
    for (const key of dictionaryPath.slice(0, -1)) {
      const next = current[key];
      if (typeof next !== 'object' || next == null) {
        current[key] = {};
      }
      current = current[key] as Dictionary;
    }

    current[dictionaryPath[dictionaryPath.length - 1]] = value;
  }

  /**
   * Look up the key
   */
  protected getCache(key: DictionaryKey): DictionaryValue | undefined {
    const dictionaryPath = getDictionaryPath(this.genKey(key));
    let current: DictionaryValue = this.getInternalCache() as Dictionary;

    if (dictionaryPath.length === 0) {
      return current;
    }

    for (const pathSegment of dictionaryPath) {
      if (typeof current !== 'object' || current == null) {
        return undefined;
      }
      current = current[pathSegment];
    }

    return current;
  }

  /**
   * Generate a key for the cache
   * @param key - The dictionary key
   * @returns The key
   */
  protected genKey(key: DictionaryKey): DictionaryPath {
    return key.id;
  }

  /**
   * Get the fallback value for a cache miss
   * @param key - The dictionary key
   * @returns The fallback value
   */
  protected fallback(key: DictionaryKey): Promise<string> {
    // Add translation request to queue
    const translationPromise = this._enqueueTranslation(key);

    // If batch is full, flush now
    if (this._queue.length >= MAX_BATCH_SIZE) {
      this._flushNow();
    } else {
      this._scheduleBatch();
    }

    return translationPromise;
  }

  // ===== PRIVATE METHODS ===== //

  // --- QUEUE MANAGEMENT --- //

  /**
   * Flush the queue now
   */
  private _flushNow(): void {
    if (this._batchTimer) {
      // eslint-disable-next-line no-undef
      clearTimeout(this._batchTimer);
      this._batchTimer = null;
    }
    this._drainQueue();
  }

  /**
   * Schedule a batch of translations
   */
  private _scheduleBatch(): void {
    if (this._batchTimer) return; // already scheduled
    // eslint-disable-next-line no-undef
    this._batchTimer = setTimeout(() => {
      this._batchTimer = null;
      this._drainQueue();
    }, BATCH_INTERVAL);
  }

  /**
   * Drain the queue
   */
  private _drainQueue(): void {
    while (
      this._queue.length > 0 &&
      this._activeRequests < MAX_CONCURRENT_REQUESTS
    ) {
      const batch = this._queue.splice(0, MAX_BATCH_SIZE);
      this._sendBatchRequest(batch);
    }
    // If items remain (hit concurrency limit), schedule again
    if (this._queue.length > 0) {
      this._scheduleBatch();
    }
  }

  /**
   * Enqueue translation request and return a promise that resolves when the translation is ready
   * @param {DictionaryKey} key - The dictionary key
   * @returns {Promise<string>} The translation promise
   */
  private _enqueueTranslation(key: DictionaryKey): Promise<string> {
    const cacheKey = this.genKey(key);
    const options = key.options;
    return new Promise<string>((resolve, reject) => {
      this._queue.push({
        key: cacheKey,
        source: key.message,
        metadata: {
          ...(options?.$context && { context: options.$context }),
          id: options?.$id ?? key.id,
          ...('$maxChars' in options &&
            options.$maxChars != null && {
              $maxChars: Math.abs(options.$maxChars),
            }),
          dataFormat: options.$format,
        },
        resolve,
        reject,
      });
    });
  }

  // --- SEND REQUESTS --- //

  /**
   * Send a batch request for translations
   * @param {QueueEntry[]} batch - The batch of requests to send
   */
  private async _sendBatchRequest(batch: QueueEntry[]): Promise<void> {
    this._activeRequests++;

    const requests = convertBatchToTranslateManyParams(batch);
    const response = await this._sendBatchRequestWithErrorHandling(
      batch,
      requests
    );
    if (response) {
      this._handleTranslationResponse(batch, response);
    }

    this._activeRequests--;
  }

  /**
   * Send a translation request with error handling
   */
  private async _sendBatchRequestWithErrorHandling(
    batch: QueueEntry[],
    requests: Record<DictionaryPath, TranslateManyEntry>
  ): Promise<ReturnType<TranslateMany> | undefined> {
    try {
      return await this._translateMany(requests);
    } catch (error) {
      for (const entry of batch) {
        entry.reject(error);
      }
      return undefined;
    }
  }

  /**
   * Handle a translation response
   */
  private _handleTranslationResponse(
    batch: QueueEntry[],
    response: Awaited<ReturnType<TranslateMany>>
  ): void {
    for (const entry of batch) {
      const { key } = entry;
      const result = response[key] as TranslationResult | undefined;
      if (result && result.success) {
        const translation = result.translation as string;
        this.setCache(key, translation);
        entry.resolve(translation);
      } else {
        entry.reject(result?.error);
      }
    }
  }
}

/**
 * Convert a DictionaryKey to a TranslateManyEntry
 */
function convertBatchToTranslateManyParams(
  batch: QueueEntry[]
): Record<DictionaryPath, TranslateManyEntry> {
  return batch.reduce<Record<DictionaryPath, TranslateManyEntry>>(
    (acc, entry) => {
      acc[entry.key] = {
        source: entry.source as Content,
        metadata: entry.metadata,
      };
      return acc;
    },
    {}
  );
}

/**
 * Convert a dictionary path string to path segments
 */
function getDictionaryPath(id: DictionaryPath): string[] {
  if (!id) {
    return [];
  }
  return id.split('.');
}

/**
 * Replace a dictionary object while preserving its reference
 */
function replaceDictionary(target: Dictionary, source: Dictionary): void {
  for (const key of Object.keys(target)) {
    delete target[key];
  }
  Object.assign(target, source);
}
