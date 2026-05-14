import { LookupOptions } from '../../translation-functions/types/options';
import type { LifecycleParam } from '../lifecycle-hooks/types';
import { Translation } from './utils/types/translation-data';
import { hashMessage } from '../../utils/hashMessage';
import type { Content } from '@generaltranslation/format/types';
import type {
  EntryMetadata,
  TranslateManyEntry,
  TranslationResult,
} from 'generaltranslation/types';

// See gt-next
const MAX_BATCH_SIZE = 25;
const MAX_CONCURRENT_REQUESTS = 100;
const BATCH_INTERVAL = 50;

export type TranslationBatchConfig = {
  maxConcurrentRequests?: number;
  maxBatchSize?: number;
  batchInterval?: number;
};

const DEFAULT_BATCH_CONFIG: Required<TranslationBatchConfig> = {
  maxConcurrentRequests: MAX_CONCURRENT_REQUESTS,
  maxBatchSize: MAX_BATCH_SIZE,
  batchInterval: BATCH_INTERVAL,
};

function getPositiveValue(value: number | undefined, defaultValue: number) {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    return defaultValue;
  }
  return value;
}

function getPositiveInteger(value: number | undefined, defaultValue: number) {
  if (value === undefined || !Number.isFinite(value)) return defaultValue;
  const integer = Math.trunc(value);
  return integer > 0 ? integer : defaultValue;
}

function normalizeBatchConfig(
  batchConfig?: TranslationBatchConfig
): Required<TranslationBatchConfig> {
  return {
    maxConcurrentRequests: getPositiveInteger(
      batchConfig?.maxConcurrentRequests,
      DEFAULT_BATCH_CONFIG.maxConcurrentRequests
    ),
    maxBatchSize: getPositiveInteger(
      batchConfig?.maxBatchSize,
      DEFAULT_BATCH_CONFIG.maxBatchSize
    ),
    batchInterval: getPositiveValue(
      batchConfig?.batchInterval,
      DEFAULT_BATCH_CONFIG.batchInterval
    ),
  };
}

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
 * A queue entry for batching, used to also handle reject and resolve
 */
type QueueEntry<TranslationValue extends Translation> = {
  key: Hash;
  source: TranslationValue;
  metadata: EntryMetadata;
  resolve: (value: Translation) => void;
  reject: (reason?: unknown) => void;
};

/**
 * TranslateMany call signature
 */
export type TranslateMany = (
  sources: Record<Hash, TranslateManyEntry>
) => Promise<Record<string, TranslationResult>>;

/**
 * A cache for a single locale's translations
 *
 * Principles:
 * - This class is language agnostic, and should never store the locale code as a parameter.
 *   Locale logic is handled at the LocalesCache level. Use a callback function that has the
 *   locale parameter embedded if you wish to use the locale code.
 */
export class TranslationsCache<TranslationValue extends Translation> {
  private cache: Record<Hash, TranslationValue>;
  private pendingTranslations = new Map<Hash, Promise<TranslationValue>>();
  private queue: Array<QueueEntry<TranslationValue>> = [];
  private batchTimer: ReturnType<typeof setTimeout> | null = null;
  private activeRequests = 0;
  private batchConfig: Required<TranslationBatchConfig>;
  private translateMany: TranslateMany;
  private lifecycle: LifecycleParam<
    TranslationKey<TranslationValue>,
    Hash,
    TranslationValue,
    TranslationValue
  >;

  /**
   * Constructor
   * @param {Object} params - The parameters for the cache
   * @param {Record<Hash, TranslationValue>} params.init - The initial cache
   * @param {Function} params.fallback - Get the fallback value for a cache miss
   */
  constructor({
    init,
    translateMany,
    lifecycle = {},
    batchConfig,
  }: {
    init: Record<Hash, TranslationValue>;
    translateMany: TranslateMany;
    batchConfig?: TranslationBatchConfig;
    lifecycle?: LifecycleParam<
      TranslationKey<TranslationValue>,
      Hash,
      TranslationValue,
      TranslationValue
    >;
  }) {
    this.cache = structuredClone(init);
    this.translateMany = translateMany;
    this.batchConfig = normalizeBatchConfig(batchConfig);
    this.lifecycle = lifecycle;
  }

  /**
   * Get the translation value for a given key
   * @param key - The translation key
   * @returns The translation value
   */
  public get<T extends TranslationValue>(
    key: TranslationKey<T>
  ): T | undefined {
    const cacheKey = this.getCacheKey(key);
    const value = this.cache[cacheKey] as T | undefined;
    if (value != null) {
      this.lifecycle.onHit?.({
        inputKey: key,
        cacheKey,
        cacheValue: value,
        outputValue: value,
      });
    }
    return value;
  }

  /**
   * Miss the cache
   * @param key - The translation key
   * @returns The translation value
   */
  public async miss<T extends TranslationValue>(
    key: TranslationKey<T>
  ): Promise<T> {
    const cacheKey = this.getCacheKey(key);
    let translationPromise = this.pendingTranslations.get(cacheKey);
    if (!translationPromise) {
      translationPromise = this.translate(key);
      this.pendingTranslations.set(cacheKey, translationPromise);
    }

    try {
      const value = await translationPromise;
      if (value != null) {
        this.lifecycle.onMiss?.({
          inputKey: key,
          cacheKey,
          cacheValue: value,
          outputValue: value,
        });
      }
      return value as T;
    } finally {
      this.pendingTranslations.delete(cacheKey);
    }
  }

  public getInternalCache(): Record<Hash, TranslationValue> {
    return structuredClone(this.cache);
  }

  private getCacheKey(key: TranslationKey<TranslationValue>): Hash {
    return hashMessage(key.message, key.options);
  }

  private translate(
    key: TranslationKey<TranslationValue>
  ): Promise<TranslationValue> {
    const translationPromise = this.enqueueTranslation(key);

    if (this.queue.length >= this.batchConfig.maxBatchSize) {
      this.flushNow();
    } else {
      this.scheduleBatch();
    }

    return translationPromise;
  }

  private flushNow(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    this.drainQueue();
  }

  private scheduleBatch(): void {
    if (this.batchTimer) return;
    this.batchTimer = setTimeout(() => {
      this.batchTimer = null;
      this.drainQueue();
    }, this.batchConfig.batchInterval);
  }

  private drainQueue(): void {
    while (
      this.queue.length > 0 &&
      this.activeRequests < this.batchConfig.maxConcurrentRequests
    ) {
      const batch = this.queue.splice(0, this.batchConfig.maxBatchSize);
      this.sendBatchRequest(batch);
    }

    if (this.queue.length > 0) {
      this.scheduleBatch();
    }
  }

  private enqueueTranslation(
    key: TranslationKey<TranslationValue>
  ): Promise<TranslationValue> {
    const hash = this.getCacheKey(key);
    const options = key.options;
    const metadataOptions = options as {
      $context?: string;
      $id?: string;
      $maxChars?: number;
    };
    return new Promise<TranslationValue>((resolve, reject) => {
      this.queue.push({
        key: hash,
        source: key.message,
        metadata: {
          hash,
          ...(metadataOptions.$context && {
            context: metadataOptions.$context,
          }),
          ...(metadataOptions.$id && { id: metadataOptions.$id }),
          ...(metadataOptions.$maxChars != null && {
            maxChars: Math.abs(metadataOptions.$maxChars),
          }),
          dataFormat: options.$format,
        },
        resolve: (value) => resolve(value as TranslationValue),
        reject,
      });
    });
  }

  private async sendBatchRequest(
    batch: QueueEntry<TranslationValue>[]
  ): Promise<void> {
    this.activeRequests++;

    const requests = convertBatchToTranslateManyParams(batch);
    const response = await this.sendBatchRequestWithErrorHandling(
      batch,
      requests
    );
    if (response) {
      this.handleTranslationResponse(batch, response);
    }

    this.activeRequests--;
  }

  private async sendBatchRequestWithErrorHandling(
    batch: QueueEntry<TranslationValue>[],
    requests: Record<Hash, TranslateManyEntry>
  ): Promise<ReturnType<TranslateMany> | undefined> {
    try {
      return await this.translateMany(requests);
    } catch (error) {
      for (const entry of batch) {
        entry.reject(error);
      }
      return undefined;
    }
  }

  private handleTranslationResponse(
    batch: QueueEntry<TranslationValue>[],
    response: Awaited<ReturnType<TranslateMany>>
  ): void {
    for (const entry of batch) {
      const { key } = entry;
      const result = response[key];
      if (result && result.success) {
        const translation = result.translation as TranslationValue;
        this.cache[key] = translation;
        entry.resolve(translation);
      } else {
        entry.reject(result?.error);
      }
    }
  }
}

/**
 * Convert a TranslationKey to a TranslateManyEntry
 */
function convertBatchToTranslateManyParams<
  TranslationValue extends Translation,
>(batch: QueueEntry<TranslationValue>[]): Record<Hash, TranslateManyEntry> {
  return batch.reduce<Record<Hash, TranslateManyEntry>>((acc, entry) => {
    acc[entry.key] = {
      source: entry.source as Content,
      metadata: entry.metadata,
    };
    return acc;
  }, {});
}
