import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  DictionaryLoader,
  LocalesDictionaryCache,
} from '../LocalesDictionaryCache';
import { DEFAULT_CACHE_EXPIRY_TIME } from '../utils/constants';
import { Dictionary } from '../DictionaryCache';

describe('LocalesDictionaryCache', () => {
  let mockLoadDictionary: ReturnType<typeof vi.fn>;
  const enDictionary: Dictionary = {
    greeting: 'Hello',
  };
  const frDictionary: Dictionary = {
    greeting: 'Bonjour',
    user: {
      name: 'Nom',
    },
  };

  beforeEach(() => {
    vi.useFakeTimers();
    mockLoadDictionary = vi.fn().mockResolvedValue(frDictionary);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function createCache(opts?: { ttl?: number | null }) {
    return new LocalesDictionaryCache({
      defaultLocale: 'en',
      dictionary: enDictionary,
      loadDictionary: mockLoadDictionary as DictionaryLoader,
      lifecycle: {},
      ...(opts?.ttl !== undefined ? { ttl: opts.ttl } : {}),
    });
  }

  // ===== REGRESSION TESTS ===== //

  it('get() returns the default locale dictionary cache without loading', () => {
    const cache = createCache();
    const dictionaryCache = cache.get('en');

    expect(dictionaryCache).toBeDefined();
    expect(dictionaryCache!.getInternalCache()).toEqual(enDictionary);
    expect(mockLoadDictionary).not.toHaveBeenCalled();
  });

  it('get() returns undefined when non-default locale is not loaded', () => {
    const cache = createCache();
    const result = cache.get('fr');
    expect(result).toBeUndefined();
  });

  it('miss() calls loadDictionary and returns a DictionaryCache', async () => {
    const cache = createCache();
    const dictionaryCache = await cache.miss('fr');

    expect(mockLoadDictionary).toHaveBeenCalledWith('fr');
    expect(dictionaryCache).toBeDefined();
    expect(dictionaryCache.getInternalCache()).toEqual(frDictionary);
  });

  it('miss() deduplicates concurrent loads for same locale', async () => {
    const cache = createCache();

    const p1 = cache.miss('fr');
    const p2 = cache.miss('fr');

    const [r1, r2] = await Promise.all([p1, p2]);

    expect(mockLoadDictionary).toHaveBeenCalledTimes(1);
    expect(r1).toBe(r2);
  });

  // ===== NEW BEHAVIOR TESTS ===== //

  it('get() returns DictionaryCache after miss() populates it', async () => {
    const cache = createCache();

    expect(cache.get('fr')).toBeUndefined();

    await cache.miss('fr');

    const dictionaryCache = cache.get('fr');
    expect(dictionaryCache).toBeDefined();
    expect(dictionaryCache!.getInternalCache()).toEqual(frDictionary);
  });

  it('get() returns undefined after default TTL (60s) expires', async () => {
    const cache = createCache();

    await cache.miss('fr');
    expect(cache.get('fr')).toBeDefined();

    vi.advanceTimersByTime(DEFAULT_CACHE_EXPIRY_TIME + 1);

    expect(cache.get('fr')).toBeUndefined();
  });

  it('ttl: null means cache never expires', async () => {
    const cache = createCache({ ttl: null });

    await cache.miss('fr');
    expect(cache.get('fr')).toBeDefined();

    vi.advanceTimersByTime(999_999_999);

    expect(cache.get('fr')).toBeDefined();
  });

  it('default locale dictionary never expires', () => {
    const cache = createCache();

    vi.advanceTimersByTime(999_999_999);

    expect(cache.get('en')).toBeDefined();
  });
});
