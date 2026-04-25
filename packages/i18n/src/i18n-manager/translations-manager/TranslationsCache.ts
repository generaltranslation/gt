import { LookupOptions } from '../../translation-functions/types/options';
import { Cache } from './Cache';
import type { LifecycleParam } from '../lifecycle-hooks/types';
import { Translation } from './utils/types/translation-data';
import type { GT } from 'generaltranslation';
import { hashMessage } from '../../utils/hashMessage';
import {
  Content,
  EntryMetadata,
  TranslateManyEntry,
} from 'generaltranslation/types';
import { BatchingQueue, BatchingQueueEntry } from '../../utils/BatchingQueue';

/**
 * InputKey type for lookups
 * @typedef {Object} TranslationKey
 * @property {TranslationValue} message - The message from the source
 * @property {LookupOptions} options - The options for the translation
 */
export type TranslationKey<TranslationValue extends Translation> = {
  message: TranslationValue;
  options: LookupOptions;
};

/**
 * Just a way to be more explicit about what "hash" is
 */
export type Hash = string;

/**
 * Per-entry payload pushed onto the batching queue. Holds the request shape
 * we need to assemble a translateMany call and the cache key to look up the
 * matching response.
 */
type QueueItem<TranslationValue extends Translation> = {
  key: Hash;
  source: TranslationValue;
  metadata: EntryMetadata;
};

/**
 * TranslateMany call signature
 */
export type TranslateMany = (
  sources: Parameters<GT['translateMany']>[0]
) => ReturnType<GT['translateMany']>;

/**
 * A cache for a single locale's translations
 *
 * Principles:
 * - This class is language agnostic, and should never store the locale code as a parameter.
 *   Locale logic is handled at the LocalesCache level. Use a callback function that has the
 *   locale parameter embedded if you wish to use the locale code.
 */
export class TranslationsCache<
  TranslationValue extends Translation,
> extends Cache<
  TranslationKey<TranslationValue>,
  Hash,
  TranslationValue,
  TranslationValue
> {
  private _translateMany: TranslateMany;
  private _queue: BatchingQueue<QueueItem<TranslationValue>, TranslationValue>;

  constructor({
    init,
    translateMany,
    lifecycle,
  }: {
    init: Record<Hash, TranslationValue>;
    translateMany: TranslateMany;
    lifecycle: LifecycleParam<
      TranslationKey<TranslationValue>,
      Hash,
      TranslationValue,
      TranslationValue
    >;
  }) {
    super(init, lifecycle);
    this._translateMany = translateMany;
    this._queue = new BatchingQueue({
      sendBatch: (entries) => this._sendBatch(entries),
    });
  }

  public get<T extends TranslationValue>(
    key: TranslationKey<T>
  ): T | undefined {
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

  public async miss<T extends TranslationValue>(
    key: TranslationKey<T>
  ): Promise<T | undefined> {
    const value = await this.missCache(key);
    if (value != null && this.onMiss) {
      this.onMiss({
        inputKey: key,
        cacheKey: this.genKey(key),
        cacheValue: value,
        outputValue: value,
      });
    }
    return value as T | undefined;
  }

  protected genKey(key: TranslationKey<TranslationValue>): Hash {
    return hashMessage(key.message, key.options);
  }

  /**
   * Cache miss path: enqueue the request and let BatchingQueue dispatch it
   * along with any other concurrent misses.
   */
  protected fallback(
    key: TranslationKey<TranslationValue>
  ): Promise<TranslationValue> {
    const cacheKey = this.genKey(key);
    const options = key.options;
    return this._queue.enqueue({
      key: cacheKey,
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
    });
  }

  /**
   * Send a single batch through translateMany and route each response back
   * to the matching queue entry. Errors thrown here are caught by the queue
   * and rejected onto every entry in the batch.
   */
  private async _sendBatch(
    entries: BatchingQueueEntry<
      QueueItem<TranslationValue>,
      TranslationValue
    >[]
  ): Promise<void> {
    const requests = convertBatchToTranslateManyParams(entries);
    const response = await this._translateMany(requests);
    for (const entry of entries) {
      const result = response[entry.item.key];
      if (result && result.success) {
        const translation = result.translation as TranslationValue;
        this.setCache(entry.item.key, translation);
        entry.resolve(translation);
      } else {
        entry.reject(result?.error);
      }
    }
  }
}

function convertBatchToTranslateManyParams<
  TranslationValue extends Translation,
>(
  entries: BatchingQueueEntry<QueueItem<TranslationValue>, TranslationValue>[]
): Record<Hash, TranslateManyEntry> {
  return entries.reduce<Record<Hash, TranslateManyEntry>>((acc, entry) => {
    acc[entry.item.key] = {
      source: entry.item.source as Content,
      metadata: entry.item.metadata,
    };
    return acc;
  }, {});
}
