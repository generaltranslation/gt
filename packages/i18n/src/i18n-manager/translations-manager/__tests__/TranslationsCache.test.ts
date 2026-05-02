import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TranslationsCache } from '../TranslationsCache';
import { hashMessage } from '../../../utils/hashMessage';
import { LookupOptions } from '../../../translation-functions/types/options';

// Helper to build a key and hash for test messages
function makeKey(message: string, options: LookupOptions = { $format: 'ICU' }) {
  const hash = hashMessage(message, options);
  return { message, options, hash };
}

// Helper to build a mock translateMany response
function mockTranslateManyResponse(
  entries: Array<{ hash: string; translation: string }>
) {
  const result: Record<string, { success: true; translation: string }> = {};
  for (const entry of entries) {
    result[entry.hash] = { success: true, translation: entry.translation };
  }
  return result;
}

describe('TranslationsCache', () => {
  let mockTranslateMany: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockTranslateMany = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ===== REGRESSION TESTS ===== //

  it('get() returns cached translation when init is pre-populated', () => {
    const { message, options, hash } = makeKey('Hello');
    const cache = new TranslationsCache({
      init: { [hash]: 'Bonjour' },
      translateMany: mockTranslateMany,
    });

    const result = cache.get({ message, options });
    expect(result).toBe('Bonjour');
    expect(mockTranslateMany).not.toHaveBeenCalled();
  });

  it('get() returns undefined on cache miss', () => {
    const { message, options } = makeKey('Hello');
    const cache = new TranslationsCache({
      init: {},
      translateMany: mockTranslateMany,
    });

    const result = cache.get({ message, options });
    expect(result).toBeUndefined();
  });

  it('miss() calls translateMany and returns the translation', async () => {
    const { message, options, hash } = makeKey('Hello');
    mockTranslateMany.mockResolvedValue(
      mockTranslateManyResponse([{ hash, translation: 'Bonjour' }])
    );

    const cache = new TranslationsCache({
      init: {},
      translateMany: mockTranslateMany,
    });

    const promise = cache.miss({ message, options });
    // Flush the batch timer
    vi.advanceTimersByTime(50);
    const result = await promise;

    expect(result).toBe('Bonjour');
    expect(mockTranslateMany).toHaveBeenCalledTimes(1);
  });

  it('miss() caches result so subsequent get() returns it', async () => {
    const { message, options, hash } = makeKey('Hello');
    mockTranslateMany.mockResolvedValue(
      mockTranslateManyResponse([{ hash, translation: 'Bonjour' }])
    );

    const cache = new TranslationsCache({
      init: {},
      translateMany: mockTranslateMany,
    });

    const promise = cache.miss({ message, options });
    vi.advanceTimersByTime(50);
    await promise;

    // Now get() should return the cached value
    const result = cache.get({ message, options });
    expect(result).toBe('Bonjour');
    expect(mockTranslateMany).toHaveBeenCalledTimes(1);
  });

  // ===== NEW BEHAVIOR TESTS ===== //

  it('miss() batches multiple requests within BATCH_INTERVAL', async () => {
    const k1 = makeKey('Hello');
    const k2 = makeKey('Goodbye');

    mockTranslateMany.mockResolvedValue(
      mockTranslateManyResponse([
        { hash: k1.hash, translation: 'Bonjour' },
        { hash: k2.hash, translation: 'Au revoir' },
      ])
    );

    const cache = new TranslationsCache({
      init: {},
      translateMany: mockTranslateMany,
    });

    const p1 = cache.miss({ message: k1.message, options: k1.options });
    const p2 = cache.miss({ message: k2.message, options: k2.options });

    // Not called yet (waiting for batch interval)
    expect(mockTranslateMany).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    const [r1, r2] = await Promise.all([p1, p2]);

    expect(r1).toBe('Bonjour');
    expect(r2).toBe('Au revoir');
    // Both were sent in a single batch
    expect(mockTranslateMany).toHaveBeenCalledTimes(1);
  });

  it('miss() flushes immediately when batch reaches MAX_BATCH_SIZE (25)', async () => {
    const keys = Array.from({ length: 25 }, (_, i) => makeKey(`msg-${i}`));

    const responseEntries = keys.map((k) => ({
      hash: k.hash,
      translation: `translated-${k.message}`,
    }));
    mockTranslateMany.mockResolvedValue(
      mockTranslateManyResponse(responseEntries)
    );

    const cache = new TranslationsCache({
      init: {},
      translateMany: mockTranslateMany,
    });

    const promises = keys.map((k) =>
      cache.miss({ message: k.message, options: k.options })
    );

    // Should have flushed immediately without waiting for timer
    expect(mockTranslateMany).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(50);
    const results = await Promise.all(promises);
    expect(results[0]).toBe('translated-msg-0');
    expect(results[24]).toBe('translated-msg-24');
  });

  it('miss() rejects promise when translateMany throws', async () => {
    const { message, options } = makeKey('Hello');
    mockTranslateMany.mockRejectedValue(new Error('API error'));

    const cache = new TranslationsCache({
      init: {},
      translateMany: mockTranslateMany,
    });

    const promise = cache.miss({ message, options });
    vi.advanceTimersByTime(50);

    await expect(promise).rejects.toThrow('API error');
  });

  it('miss() rejects entry when translateMany returns success: false', async () => {
    const { message, options, hash } = makeKey('Hello');
    mockTranslateMany.mockResolvedValue({
      [hash]: { success: false, error: 'Translation failed' },
    });

    const cache = new TranslationsCache({
      init: {},
      translateMany: mockTranslateMany,
    });

    const promise = cache.miss({ message, options });
    vi.advanceTimersByTime(50);

    await expect(promise).rejects.toBe('Translation failed');
  });

  it('miss() deduplicates inflight requests for same key', async () => {
    const { message, options, hash } = makeKey('Hello');
    mockTranslateMany.mockResolvedValue(
      mockTranslateManyResponse([{ hash, translation: 'Bonjour' }])
    );

    const cache = new TranslationsCache({
      init: {},
      translateMany: mockTranslateMany,
    });

    // Two miss() calls for the same key before resolution
    const p1 = cache.miss({ message, options });
    const p2 = cache.miss({ message, options });

    vi.advanceTimersByTime(50);
    const [r1, r2] = await Promise.all([p1, p2]);

    expect(r1).toBe('Bonjour');
    expect(r2).toBe('Bonjour');
    // The base Cache class deduplicates inflight fallbacks,
    // so translateMany should only be called once
    expect(mockTranslateMany).toHaveBeenCalledTimes(1);
  });
});
