import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LocalesCache, SafeTranslationsLoader } from '../LocalesCache';
import { Hash } from '../TranslationsCache';
import { CreateTranslateMany } from '../utils/createTranslateMany';
import { DEFAULT_CACHE_EXPIRY_TIME } from '../utils/constants';

describe('LocalesCache', () => {
  let mockLoadTranslations: ReturnType<typeof vi.fn>;
  let mockCreateTranslateMany: ReturnType<typeof vi.fn>;
  const frTranslations: Record<Hash, string> = {
    hash1: 'Bonjour',
    hash2: 'Au revoir',
  };

  beforeEach(() => {
    vi.useFakeTimers();
    mockLoadTranslations = vi.fn().mockResolvedValue(frTranslations);
    mockCreateTranslateMany = vi.fn().mockReturnValue(vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function createCache(opts?: { ttl?: number | null }) {
    return new LocalesCache<string>({
      loadTranslations: mockLoadTranslations as SafeTranslationsLoader<string>,
      createTranslateMany: mockCreateTranslateMany as CreateTranslateMany,
      ...(opts?.ttl !== undefined ? { ttl: opts.ttl } : {}),
    });
  }

  // ===== REGRESSION TESTS ===== //

  it('get() returns undefined when locale not loaded', () => {
    const cache = createCache();
    const result = cache.get('fr');
    expect(result).toBeUndefined();
  });

  it('miss() calls loadTranslations and returns a TranslationsCache', async () => {
    const cache = createCache();
    const txCache = await cache.miss('fr');

    expect(mockLoadTranslations).toHaveBeenCalledWith('fr');
    expect(txCache).toBeDefined();
    // The returned TranslationsCache should have the loaded translations
    const internal = txCache.getInternalCache();
    expect(internal['hash1']).toBe('Bonjour');
    expect(internal['hash2']).toBe('Au revoir');
  });

  it('miss() deduplicates concurrent loads for same locale', async () => {
    const cache = createCache();

    const p1 = cache.miss('fr');
    const p2 = cache.miss('fr');

    const [r1, r2] = await Promise.all([p1, p2]);

    expect(mockLoadTranslations).toHaveBeenCalledTimes(1);
    // Both resolve to the same TranslationsCache
    expect(r1).toBe(r2);
  });

  // ===== NEW BEHAVIOR TESTS ===== //

  it('get() returns TranslationsCache after miss() populates it', async () => {
    const cache = createCache();

    // Before load
    expect(cache.get('fr')).toBeUndefined();

    // Load
    await cache.miss('fr');

    // After load
    const txCache = cache.get('fr');
    expect(txCache).toBeDefined();
    expect(txCache!.getInternalCache()['hash1']).toBe('Bonjour');
  });

  it('get() returns undefined after default TTL (60s) expires', async () => {
    const cache = createCache(); // default TTL = 60s

    await cache.miss('fr');
    expect(cache.get('fr')).toBeDefined();

    // Advance past default TTL
    vi.advanceTimersByTime(DEFAULT_CACHE_EXPIRY_TIME + 1);

    expect(cache.get('fr')).toBeUndefined();
  });

  it('ttl: null means cache never expires', async () => {
    const cache = createCache({ ttl: null });

    await cache.miss('fr');
    expect(cache.get('fr')).toBeDefined();

    // Advance by a very large amount
    vi.advanceTimersByTime(999_999_999);

    // Still valid
    expect(cache.get('fr')).toBeDefined();
  });

  it('custom TTL is respected', async () => {
    const cache = createCache({ ttl: 5000 });

    await cache.miss('fr');

    // Just before expiry
    vi.advanceTimersByTime(4999);
    expect(cache.get('fr')).toBeDefined();

    // After expiry
    vi.advanceTimersByTime(2);
    expect(cache.get('fr')).toBeUndefined();
  });
});
