import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BatchingQueue, BatchingQueueEntry } from '../BatchingQueue';

describe('BatchingQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('batches enqueues that arrive within the interval into a single sendBatch call', async () => {
    const sendBatch = vi.fn(
      async (entries: BatchingQueueEntry<string, string>[]) => {
        for (const e of entries) e.resolve(e.item.toUpperCase());
      }
    );
    const q = new BatchingQueue<string, string>({ sendBatch });

    const p1 = q.enqueue('a');
    const p2 = q.enqueue('b');
    const p3 = q.enqueue('c');

    expect(sendBatch).not.toHaveBeenCalled();
    vi.advanceTimersByTime(50);
    const results = await Promise.all([p1, p2, p3]);

    expect(sendBatch).toHaveBeenCalledTimes(1);
    expect(sendBatch.mock.calls[0][0].map((e) => e.item)).toEqual([
      'a',
      'b',
      'c',
    ]);
    expect(results).toEqual(['A', 'B', 'C']);
  });

  it('flushes immediately when batch reaches maxBatchSize', async () => {
    const sendBatch = vi.fn(
      async (entries: BatchingQueueEntry<number, number>[]) => {
        for (const e of entries) e.resolve(e.item * 2);
      }
    );
    const q = new BatchingQueue<number, number>({
      sendBatch,
      maxBatchSize: 3,
    });

    const p1 = q.enqueue(1);
    const p2 = q.enqueue(2);
    const p3 = q.enqueue(3);

    expect(sendBatch).toHaveBeenCalledTimes(1);
    const results = await Promise.all([p1, p2, p3]);
    expect(results).toEqual([2, 4, 6]);
  });

  it('splits enqueues exceeding maxBatchSize across multiple batches', async () => {
    const sendBatch = vi.fn(
      async (entries: BatchingQueueEntry<number, number>[]) => {
        for (const e of entries) e.resolve(e.item);
      }
    );
    const q = new BatchingQueue<number, number>({
      sendBatch,
      maxBatchSize: 2,
    });

    const ps = [1, 2, 3, 4, 5].map((n) => q.enqueue(n));
    vi.advanceTimersByTime(50);
    await Promise.all(ps);

    expect(sendBatch).toHaveBeenCalledTimes(3);
    const callItems = sendBatch.mock.calls.map((call) =>
      call[0].map((e) => e.item)
    );
    expect(callItems).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('rejects all entries in batch when sendBatch throws', async () => {
    const sendBatch = vi.fn(async () => {
      throw new Error('boom');
    });
    const q = new BatchingQueue<string, string>({ sendBatch });

    const p1 = q.enqueue('a');
    const p2 = q.enqueue('b');

    vi.advanceTimersByTime(50);

    await expect(p1).rejects.toThrow('boom');
    await expect(p2).rejects.toThrow('boom');
  });

  it('lets caller resolve some entries and reject others within a batch', async () => {
    const sendBatch = vi.fn(
      async (entries: BatchingQueueEntry<string, string>[]) => {
        for (const e of entries) {
          if (e.item === 'bad') e.reject(new Error('per-entry'));
          else e.resolve(e.item.toUpperCase());
        }
      }
    );
    const q = new BatchingQueue<string, string>({ sendBatch });

    const p1 = q.enqueue('a');
    const p2 = q.enqueue('bad');
    const p3 = q.enqueue('c');

    vi.advanceTimersByTime(50);

    await expect(p1).resolves.toBe('A');
    await expect(p2).rejects.toThrow('per-entry');
    await expect(p3).resolves.toBe('C');
  });

  it('respects maxConcurrent and reschedules remaining items', async () => {
    let release!: () => void;
    const blocker = new Promise<void>((resolve) => {
      release = resolve;
    });

    const sendBatch = vi.fn(
      async (entries: BatchingQueueEntry<number, number>[]) => {
        await blocker;
        for (const e of entries) e.resolve(e.item);
      }
    );

    const q = new BatchingQueue<number, number>({
      sendBatch,
      maxBatchSize: 1,
      maxConcurrent: 1,
    });

    // Enqueue 3 items; with maxConcurrent=1 only the first batch goes out
    // immediately. Items 2 and 3 are queued behind a scheduled timer.
    const p1 = q.enqueue(1);
    const p2 = q.enqueue(2);
    const p3 = q.enqueue(3);

    expect(sendBatch).toHaveBeenCalledTimes(1);

    // Release the in-flight batch and let all subsequent timers fire.
    release();
    await vi.runAllTimersAsync();
    await Promise.all([p1, p2, p3]);

    // Each item went out as its own batch (maxBatchSize=1).
    expect(sendBatch).toHaveBeenCalledTimes(3);
  });
});
