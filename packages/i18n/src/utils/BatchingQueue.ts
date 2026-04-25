/**
 * Default batching parameters. Match the values originally hard-coded in
 * TranslationsCache, react-core's useRuntimeTranslation, and gt-next's
 * I18NConfiguration so behavior stays unchanged after the refactor.
 */
const DEFAULT_MAX_BATCH_SIZE = 25;
const DEFAULT_BATCH_INTERVAL = 50;
const DEFAULT_MAX_CONCURRENT = 100;

export type BatchingQueueEntry<TItem, TResult> = {
  item: TItem;
  resolve: (value: TResult) => void;
  reject: (reason?: unknown) => void;
};

export type BatchingQueueOptions<TItem, TResult> = {
  /**
   * Process a batch. The caller is responsible for resolving or rejecting
   * each entry. If sendBatch throws, the queue will reject all entries in
   * the batch with the thrown error as a safety net.
   */
  sendBatch: (
    entries: BatchingQueueEntry<TItem, TResult>[]
  ) => Promise<void> | void;
  /** Maximum items per batch. Reaching it flushes immediately. */
  maxBatchSize?: number;
  /** Time in ms to wait before flushing a non-full batch. */
  batchInterval?: number;
  /** Maximum concurrent in-flight sendBatch calls. */
  maxConcurrent?: number;
};

/**
 * Generic queue that collects items, groups them into batches, and dispatches
 * them via a caller-provided sendBatch function. Used by translation caches
 * that need to coalesce many small lookups into fewer network requests.
 */
export class BatchingQueue<TItem, TResult = unknown> {
  private _queue: BatchingQueueEntry<TItem, TResult>[] = [];
  // eslint-disable-next-line no-undef
  private _timer: ReturnType<typeof setTimeout> | null = null;
  private _activeRequests = 0;
  private readonly _sendBatch: BatchingQueueOptions<
    TItem,
    TResult
  >['sendBatch'];
  private readonly _maxBatchSize: number;
  private readonly _batchInterval: number;
  private readonly _maxConcurrent: number;

  constructor(opts: BatchingQueueOptions<TItem, TResult>) {
    this._sendBatch = opts.sendBatch;
    this._maxBatchSize = opts.maxBatchSize ?? DEFAULT_MAX_BATCH_SIZE;
    this._batchInterval = opts.batchInterval ?? DEFAULT_BATCH_INTERVAL;
    this._maxConcurrent = opts.maxConcurrent ?? DEFAULT_MAX_CONCURRENT;
  }

  /**
   * Enqueue an item. Returns a promise that resolves or rejects when the
   * caller's sendBatch processes the entry.
   */
  enqueue(item: TItem): Promise<TResult> {
    return new Promise<TResult>((resolve, reject) => {
      this._queue.push({ item, resolve, reject });
      if (this._queue.length >= this._maxBatchSize) {
        this._flushNow();
      } else {
        this._schedule();
      }
    });
  }

  private _flushNow(): void {
    if (this._timer) {
      // eslint-disable-next-line no-undef
      clearTimeout(this._timer);
      this._timer = null;
    }
    this._drain();
  }

  private _schedule(): void {
    if (this._timer) return;
    // eslint-disable-next-line no-undef
    this._timer = setTimeout(() => {
      this._timer = null;
      this._drain();
    }, this._batchInterval);
  }

  private _drain(): void {
    while (
      this._queue.length > 0 &&
      this._activeRequests < this._maxConcurrent
    ) {
      const batch = this._queue.splice(0, this._maxBatchSize);
      this._send(batch);
    }
    if (this._queue.length > 0) {
      this._schedule();
    }
  }

  private async _send(
    batch: BatchingQueueEntry<TItem, TResult>[]
  ): Promise<void> {
    this._activeRequests++;
    try {
      await this._sendBatch(batch);
    } catch (error) {
      // Safety net: if sendBatch throws without resolving entries, reject
      // them. Already-resolved entries ignore subsequent reject() calls.
      for (const entry of batch) {
        entry.reject(error);
      }
    } finally {
      this._activeRequests--;
    }
  }
}
