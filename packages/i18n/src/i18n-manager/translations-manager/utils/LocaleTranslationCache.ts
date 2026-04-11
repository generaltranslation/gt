import { ResolutionOptions } from '../../../translation-functions/types/options';
import { Cache } from './Cache';
import { Translation } from './types/translation-data';
import type { GT } from 'generaltranslation';
import { hashMessage } from '../../../utils/hashMessage';
import {
  Content,
  EntryMetadata,
  TranslateManyEntry,
} from 'generaltranslation/types';
import logger from '../../../logs/logger';

// See gt-next
const MAX_BATCH_SIZE = 25;
const MAX_CONCURRENT_REQUESTS = 100;
const BATCH_INTERVAL = 50;

/**
 * InputKey type for lookups
 * @typedef {Object} TranslationKey
 * @property {TranslationValue} message - The message from the source
 * @property {ResolutionOptions} options - The options for the translation
 */
type TranslationKey<TranslationValue extends Translation | unknown> = {
  message: TranslationValue;
  options: ResolutionOptions;
};

/**
 * Just a way to be more explicit about what "hash" is
 */
type Hash = string;

/**
 * A queue entry for batching, used to also handle reject and resolve
 */
type QueueEntry<TranslationValue extends Translation | unknown> = {
  key: Hash;
  source: TranslationValue;
  metadata: EntryMetadata;
  resolve: (value: TranslationValue) => void;
  reject: (reason?: unknown) => void;
};

/**
 * TranslateMany call signature
 */
type TranslateManyCallSignature = (
  sources: Parameters<GT['translateMany']>[0],
  timeout?: Parameters<GT['translateMany']>[2]
) => ReturnType<GT['translateMany']>;

/**
 * A cache for a single locale's translations
 */
export class LocaleTranslationCache<
  TranslationValue extends Translation | unknown = Translation,
> extends Cache<TranslationKey<TranslationValue>, Hash, TranslationValue> {
  /**
   * Queue of translation requests
   */
  private _queue: Array<QueueEntry<TranslationValue>> = [];

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
   * TODO: omit the targetLocale requirement from the second argument, this can be supplied
   * on instantiation
   */
  private _translateMany: TranslateManyCallSignature;

  /**
   * Constructor
   * @param {Object} params - The parameters for the cache
   * @param {Record<Hash, TranslationValue>} params.init - The initial cache
   * @param {Function} params.fallback - Get the fallback value for a cache miss
   */
  constructor({
    init,
    translateMany,
  }: {
    init: Record<Hash, TranslationValue>;
    translateMany: TranslateManyCallSignature;
  }) {
    super(init);
    this._translateMany = translateMany;
  }

  genKey(key: TranslationKey<TranslationValue>): Hash {
    return hashMessage(key.message, key.options);
  }

  fallback(key: TranslationKey<TranslationValue>): Promise<TranslationValue> {
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

  /**
   * Send a batch request for translations
   * @param {QueueEntry<TranslationValue>[]} batch - The batch of requests to send
   */
  private async _sendBatchRequest(
    batch: QueueEntry<TranslationValue>[]
  ): Promise<void> {
    this._activeRequests++;

    try {
      // --- Preprocess requests --- //
      const requests: Record<string, TranslateManyEntry> = batch.reduce<
        Record<string, TranslateManyEntry>
      >((acc, entry) => {
        acc[entry.key] = {
          source: entry.source as Content,
          metadata: entry.metadata,
        };
        return acc;
      }, {});

      // --- Send request --- //
      const response = await this._translateMany(requests);

      // --- Process response --- //
      for (const entry of batch) {
        const { key } = entry;
        const result = response[key];
        if (result && result.success) {
          const translation = result.translation as TranslationValue;
          this.setWithCacheKey(key, translation);
          entry.resolve(translation);
        } else {
          entry.reject(result?.error);
        }
      }
    } catch (error) {
      // Log error
      if (error instanceof Error && error.name === 'AbortError') {
        logger.warn('Translation request timed out');
      } else {
        logger.error(String(error));
      }

      // Reject all promises
      for (const entry of batch) {
        entry.reject(error);
      }
    } finally {
      this._activeRequests--;
    }
  }

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
   * @param {TranslationKey<TranslationValue>} key - The translation key
   * @returns {Promise<TranslationValue>} The translation promise
   */
  private _enqueueTranslation(
    key: TranslationKey<TranslationValue>
  ): Promise<TranslationValue> {
    const options = key.options;
    return new Promise<TranslationValue>((resolve, reject) => {
      this._queue.push({
        key: this.genKey(key),
        source: key.message,
        metadata: {
          ...(options?.$context && { context: options.$context }),
          ...(options?.$id && { id: options.$id }),
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
}
