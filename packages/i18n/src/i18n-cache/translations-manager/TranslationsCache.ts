import { LookupOptions } from '../../translation-functions/types/options';
import { Translation } from './utils/types/translation-data';
import { hashMessage } from '../../utils/hashMessage';
import { dedupePending } from './utils/dedupePending';
import type { Content } from '@generaltranslation/format/types';
import type {
  EntryMetadata,
  TranslateManyEntry,
  TranslationResult,
} from 'generaltranslation/types';

export type TranslationBatchConfig = {
  maxConcurrentRequests?: number;
  maxBatchSize?: number;
  batchInterval?: number;
};

// See gt-next
const DEFAULT_BATCH_CONFIG: Required<TranslationBatchConfig> = {
  maxConcurrentRequests: 100,
  maxBatchSize: 25,
  batchInterval: 50,
};

function getPositiveValue(
  value: number | undefined,
  defaultValue: number,
  integer = false
) {
  if (value === undefined || !Number.isFinite(value)) return defaultValue;
  const resolved = integer ? Math.trunc(value) : value;
  return resolved > 0 ? resolved : defaultValue;
}

function normalizeBatchConfig(
  batchConfig?: TranslationBatchConfig
): Required<TranslationBatchConfig> {
  return {
    maxConcurrentRequests: getPositiveValue(
      batchConfig?.maxConcurrentRequests,
      DEFAULT_BATCH_CONFIG.maxConcurrentRequests,
      true
    ),
    maxBatchSize: getPositiveValue(
      batchConfig?.maxBatchSize,
      DEFAULT_BATCH_CONFIG.maxBatchSize,
      true
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
 * Just being explicit about the purpose of this type
 */
export type Locale = string;

/**
 * Called when a translation is resolved through a runtime cache miss.
 * Locale is handled by the I18nCache that owns this cache, so it is not
 * passed here.
 */
export type TranslationsCacheMissCallback<
  TranslationValue extends Translation,
> = (hash: Hash, translation: TranslationValue) => void;

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
 *   Locale logic is handled by the owning I18nCache. Use a callback function that has the
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
  private onMiss?: TranslationsCacheMissCallback<TranslationValue>;

  /**
   * Constructor
   * @param {Object} params - The parameters for the cache
   * @param {Record<Hash, TranslationValue>} params.init - The initial cache
   * @param {Function} params.fallback - Get the fallback value for a cache miss
   */
  constructor({
    init,
    translateMany,
    onMiss,
    batchConfig,
  }: {
    init: Record<Hash, TranslationValue>;
    translateMany: TranslateMany;
    batchConfig?: TranslationBatchConfig;
    onMiss?: TranslationsCacheMissCallback<TranslationValue>;
  }) {
    this.cache = structuredClone(init);
    this.translateMany = translateMany;
    this.batchConfig = normalizeBatchConfig(batchConfig);
    this.onMiss = onMiss;
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
    return this.cache[cacheKey] as T | undefined;
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
    const value = await dedupePending(this.pendingTranslations, cacheKey, () =>
      this.translate(key)
    );
    if (value != null) {
      this.onMiss?.(cacheKey, value);
    }
    return value as T;
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

  public update(translations: Record<Hash, TranslationValue>): void {
    this.cache = { ...this.cache, ...translations };
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
      $requiresReview?: boolean;
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
          // The hash is review-aware; the request metadata must carry the
          // same intent so the platform records it on anything it persists
          ...(metadataOptions.$requiresReview === true && {
            requiresReview: true,
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
