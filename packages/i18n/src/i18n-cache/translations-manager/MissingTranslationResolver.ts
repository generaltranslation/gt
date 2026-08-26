import type { Content } from '@generaltranslation/format/types';
import type {
  EntryMetadata,
  TranslateManyEntry,
  TranslationResult,
} from 'generaltranslation/types';
import type { LookupOptions } from '../../translation-functions/types/options';
import { dedupePending } from './utils/dedupePending';
import type { Translation } from './utils/types/translation-data';

export type TranslationBatchConfig = {
  maxConcurrentRequests?: number;
  maxBatchSize?: number;
  batchInterval?: number;
};

export type MissingTranslationRequest<
  TranslationValue extends Translation = Translation,
> = {
  hash: string;
  source: TranslationValue;
  options: LookupOptions;
};

export type ResolveMissingTranslation<
  TranslationValue extends Translation = Translation,
> = (
  request: MissingTranslationRequest<TranslationValue>
) => Promise<TranslationValue | undefined>;

export type CreateMissingTranslationResolver<
  TranslationValue extends Translation = Translation,
> = (locale: string) => ResolveMissingTranslation<TranslationValue> | undefined;

export type TranslateMany = (
  sources: Record<string, TranslateManyEntry>
) => Promise<Record<string, TranslationResult>>;

type QueueEntry<TranslationValue extends Translation> = {
  request: MissingTranslationRequest<TranslationValue>;
  resolve: (value: TranslationValue) => void;
  reject: (reason?: unknown) => void;
};

const DEFAULT_BATCH_CONFIG: Required<TranslationBatchConfig> = {
  maxConcurrentRequests: 100,
  maxBatchSize: 25,
  batchInterval: 50,
};

export function createBatchedMissingTranslationResolver<
  TranslationValue extends Translation,
>(
  translateMany: TranslateMany,
  batchConfig?: TranslationBatchConfig
): ResolveMissingTranslation<TranslationValue> {
  const resolver = new BatchedMissingTranslationResolver<TranslationValue>(
    translateMany,
    batchConfig
  );
  return (request) => resolver.resolve(request);
}

class BatchedMissingTranslationResolver<TranslationValue extends Translation> {
  private readonly pending = new Map<string, Promise<TranslationValue>>();
  private readonly queue: Array<QueueEntry<TranslationValue>> = [];
  private readonly batchConfig: Required<TranslationBatchConfig>;
  private batchTimer: ReturnType<typeof setTimeout> | undefined;
  private activeRequests = 0;

  constructor(
    private readonly translateMany: TranslateMany,
    batchConfig?: TranslationBatchConfig
  ) {
    this.batchConfig = normalizeBatchConfig(batchConfig);
  }

  resolve(
    request: MissingTranslationRequest<TranslationValue>
  ): Promise<TranslationValue> {
    return dedupePending(this.pending, request.hash, () =>
      this.enqueue(request)
    );
  }

  private enqueue(
    request: MissingTranslationRequest<TranslationValue>
  ): Promise<TranslationValue> {
    const translation = new Promise<TranslationValue>((resolve, reject) => {
      this.queue.push({ request, resolve, reject });
    });

    if (this.queue.length >= this.batchConfig.maxBatchSize) {
      this.flushNow();
    } else {
      this.scheduleBatch();
    }

    return translation;
  }

  private flushNow(): void {
    if (this.batchTimer) clearTimeout(this.batchTimer);
    this.batchTimer = undefined;
    this.drainQueue();
  }

  private scheduleBatch(): void {
    if (this.batchTimer) return;
    this.batchTimer = setTimeout(() => {
      this.batchTimer = undefined;
      this.drainQueue();
    }, this.batchConfig.batchInterval);
  }

  private drainQueue(): void {
    while (
      this.queue.length > 0 &&
      this.activeRequests < this.batchConfig.maxConcurrentRequests
    ) {
      const batch = this.queue.splice(0, this.batchConfig.maxBatchSize);
      void this.sendBatch(batch);
    }

    if (this.queue.length > 0) this.scheduleBatch();
  }

  private async sendBatch(
    batch: Array<QueueEntry<TranslationValue>>
  ): Promise<void> {
    this.activeRequests++;

    try {
      const response = await this.translateMany(toTranslateManyParams(batch));
      for (const entry of batch) {
        const result = response[entry.request.hash];
        if (result?.success) {
          entry.resolve(result.translation as TranslationValue);
        } else {
          entry.reject(result?.error);
        }
      }
    } catch (error) {
      for (const entry of batch) entry.reject(error);
    } finally {
      this.activeRequests--;
      this.drainQueue();
    }
  }
}

function toTranslateManyParams<TranslationValue extends Translation>(
  batch: Array<QueueEntry<TranslationValue>>
): Record<string, TranslateManyEntry> {
  return Object.fromEntries(
    batch.map(({ request }) => [
      request.hash,
      {
        source: request.source as Content,
        metadata: toEntryMetadata(request),
      },
    ])
  );
}

function toEntryMetadata<TranslationValue extends Translation>({
  hash,
  options,
}: MissingTranslationRequest<TranslationValue>): EntryMetadata {
  return {
    hash,
    ...(options.$context && { context: options.$context }),
    ...(options.$id && { id: options.$id }),
    ...(options.$maxChars != null && {
      maxChars: Math.abs(options.$maxChars),
    }),
    ...(options.$requiresReview === true && { requiresReview: true }),
    dataFormat: options.$format,
  };
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

function getPositiveValue(
  value: number | undefined,
  defaultValue: number,
  integer = false
): number {
  if (value === undefined || !Number.isFinite(value)) return defaultValue;
  const resolved = integer ? Math.trunc(value) : value;
  return resolved > 0 ? resolved : defaultValue;
}
