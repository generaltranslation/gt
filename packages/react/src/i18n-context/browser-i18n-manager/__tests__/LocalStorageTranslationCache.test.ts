import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LocalStorageTranslationCache } from '../LocalStorageTranslationCache';

// ===== Mock localStorage (not available in Node test environment) ===== //

const mockStorage = new Map<string, string>();
const mockLocalStorage = {
  getItem: vi.fn((key: string) => mockStorage.get(key) ?? null),
  setItem: vi.fn((key: string, val: string) => mockStorage.set(key, val)),
  removeItem: vi.fn((key: string) => mockStorage.delete(key)),
};
vi.stubGlobal('localStorage', mockLocalStorage);

// ===== Constants (mirrored from source for assertion clarity) ===== //

const FLUSH_INTERVAL = 500;

// ===== Helpers ===== //

function createCache(
  overrides: Partial<
    ConstructorParameters<typeof LocalStorageTranslationCache>[0]
  > = {}
) {
  return new LocalStorageTranslationCache({
    locale: 'es',
    projectId: 'test-project',
    ...overrides,
  });
}

/** Get the raw serialized cache from mock localStorage */
function getRawStorage(
  locale = 'es',
  projectId = 'test-project'
): string | null {
  return mockStorage.get(`gt:tx:${projectId}:${locale}`) ?? null;
}

/** Parse the stored cache entries */
function getParsedStorage(
  locale = 'es',
  projectId = 'test-project'
): Record<string, { t: unknown; exp: number }> {
  const raw = getRawStorage(locale, projectId);
  return raw ? JSON.parse(raw) : {};
}

// ===== Tests ===== //

describe('LocalStorageTranslationCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ===== Initialization ===== //

  describe('initialization', () => {
    // new LocalStorageTranslationCache({ locale: 'es', projectId: 'p1' })
    // → empty cache, nothing written to localStorage yet
    it('creates empty cache without init values', () => {
      createCache();
      expect(getRawStorage()).toBeNull();
    });

    // new LocalStorageTranslationCache({ locale: 'es', projectId: 'p1', init: { hash1: 'Hola' } })
    // → localStorage seeded immediately with init values (wrapped with expiry)
    it('seeds localStorage with init values', () => {
      createCache({ init: { hash1: 'Hola' } });
      const stored = getParsedStorage();
      expect(stored['hash1']).toBeDefined();
      expect(stored['hash1'].t).toBe('Hola');
      expect(stored['hash1'].exp).toBeGreaterThan(Date.now());
    });

    // Storage key is deterministic: gt:tx:{projectId}:{locale}
    it('uses consistent storage key from locale + projectId', () => {
      createCache({
        locale: 'fr',
        projectId: 'my-proj',
        init: { h: 'Bonjour' },
      });
      expect(mockStorage.has('gt:tx:my-proj:fr')).toBe(true);
    });
  });

  // ===== Write and flush ===== //

  describe('write and flush', () => {
    // cache.write('hash1', 'Hola') → not immediately in localStorage
    // → after FLUSH_INTERVAL → appears in localStorage
    it('buffers writes and flushes after debounce interval', () => {
      const cache = createCache();
      cache.write('hash1', 'Hola');

      // Not flushed yet
      expect(getRawStorage()).toBeNull();

      // Advance past flush interval
      vi.advanceTimersByTime(FLUSH_INTERVAL + 10);

      // Now flushed
      const stored = getParsedStorage();
      expect(stored['hash1']).toBeDefined();
      expect(stored['hash1'].t).toBe('Hola');
    });

    // Multiple writes before flush → single localStorage.setItem call
    it('batches multiple writes into one flush', () => {
      const cache = createCache();
      cache.write('hash1', 'Hola');
      cache.write('hash2', 'Mundo');

      vi.advanceTimersByTime(FLUSH_INTERVAL + 10);

      const stored = getParsedStorage();
      expect(stored['hash1'].t).toBe('Hola');
      expect(stored['hash2'].t).toBe('Mundo');
    });

    // getInternalCache() returns buffer entries even before flush
    it('getInternalCache includes pending buffer entries', () => {
      const cache = createCache();
      cache.write('hash1', 'Hola');

      // Before flush — buffer entries should still be visible
      const result = cache.getInternalCache();
      expect(result['hash1']).toBe('Hola');
    });
  });

  // ===== TTL and expiry ===== //

  describe('TTL and expiry', () => {
    // Write entry with short TTL, advance past it → getInternalCache excludes it
    it('filters expired entries from getInternalCache', () => {
      const TTL = 1000; // 1 second
      const cache = createCache({ ttl: TTL, init: { hash1: 'Hola' } });

      // Entry exists immediately
      expect(cache.getInternalCache()['hash1']).toBe('Hola');

      // Advance past TTL
      vi.advanceTimersByTime(TTL + 10);

      // Entry should be filtered out
      expect(cache.getInternalCache()['hash1']).toBeUndefined();
    });

    // Background purge fires at purge interval, removes expired entries from storage
    it('background purge removes expired entries from localStorage', () => {
      const TTL = 1000;
      const PURGE_INTERVAL = 2000;
      const cache = createCache({
        ttl: TTL,
        purgeInterval: PURGE_INTERVAL,
        init: { hash1: 'Hola' },
      });

      // Entry exists in storage
      expect(getParsedStorage()['hash1']).toBeDefined();

      // Advance past TTL + purge interval so background purge fires
      vi.advanceTimersByTime(TTL + PURGE_INTERVAL + 10);

      // Entry should be purged from localStorage
      const stored = getParsedStorage();
      expect(stored['hash1']).toBeUndefined();
    });
  });

  // ===== Error handling ===== //

  describe('error handling', () => {
    // localStorage.setItem throws (quota exceeded) → silently fails, no crash
    it('silently handles localStorage quota exceeded', () => {
      mockLocalStorage.setItem.mockImplementationOnce(() => {
        throw new Error('QuotaExceededError');
      });

      const cache = createCache();
      cache.write('hash1', 'Hola');

      // Should not throw
      expect(() => vi.advanceTimersByTime(FLUSH_INTERVAL + 10)).not.toThrow();
    });

    // localStorage.getItem returns corrupted JSON → returns empty cache
    it('handles corrupted localStorage data gracefully', () => {
      mockStorage.set('gt:tx:test-project:es', '{not valid json!!!');
      const cache = createCache();

      // Should not throw, returns empty
      const result = cache.getInternalCache();
      expect(Object.keys(result)).toHaveLength(0);
    });
  });

  // ===== Purge ===== //

  describe('purge', () => {
    // cache.purge(['hash1']) removes specific entries from localStorage
    it('removes specific entries by hash', () => {
      const cache = createCache({
        init: { hash1: 'Hola', hash2: 'Mundo' },
      });

      cache.purge(['hash1']);

      const stored = getParsedStorage();
      expect(stored['hash1']).toBeUndefined();
      expect(stored['hash2']).toBeDefined();
    });
  });
});
