import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DictionaryCache, Dictionary } from '../DictionaryCache';
import { LookupOptions } from '../../../translation-functions/types/options';

function makeKey(
  id: string,
  message = 'Hello',
  options: LookupOptions = { $format: 'ICU' }
) {
  return { id, message, options };
}

function mockTranslateManyResponse(
  entries: Array<{ id: string; translation: string }>
) {
  const result: Record<string, { success: true; translation: string }> = {};
  for (const entry of entries) {
    result[entry.id] = { success: true, translation: entry.translation };
  }
  return result;
}

describe('DictionaryCache', () => {
  let mockTranslateMany: ReturnType<typeof vi.fn>;
  const dictionary: Dictionary = {
    greeting: 'Hello',
    user: {
      profile: {
        name: 'Name',
      },
    },
  };

  beforeEach(() => {
    vi.useFakeTimers();
    mockTranslateMany = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ===== REGRESSION TESTS ===== //

  it('get() returns cached dictionary leaf when init is pre-populated', () => {
    const cache = new DictionaryCache({
      init: dictionary,
      translateMany: mockTranslateMany,
    });

    const result = cache.get(makeKey('user.profile.name', 'Name'));
    expect(result).toBe('Name');
    expect(mockTranslateMany).not.toHaveBeenCalled();
  });

  it('get() returns cached dictionary subtree when init is pre-populated', () => {
    const cache = new DictionaryCache({
      init: dictionary,
      translateMany: mockTranslateMany,
    });

    const result = cache.get(makeKey('user', 'User'));
    expect(result).toEqual({
      profile: {
        name: 'Name',
      },
    });
  });

  it('get() returns undefined on cache miss', () => {
    const cache = new DictionaryCache({
      init: dictionary,
      translateMany: mockTranslateMany,
    });

    const result = cache.get(makeKey('missing.entry', 'Missing'));
    expect(result).toBeUndefined();
  });

  it('miss() calls translateMany and returns the translation', async () => {
    mockTranslateMany.mockResolvedValue(
      mockTranslateManyResponse([
        { id: 'user.profile.name', translation: 'Nom' },
      ])
    );

    const cache = new DictionaryCache({
      init: {},
      translateMany: mockTranslateMany,
    });

    const promise = cache.miss(makeKey('user.profile.name', 'Name'));
    vi.advanceTimersByTime(50);
    const result = await promise;

    expect(result).toBe('Nom');
    expect(mockTranslateMany).toHaveBeenCalledTimes(1);
    expect(cache.get(makeKey('user.profile.name', 'Name'))).toBe('Nom');
    expect(cache.getInternalCache()).toEqual({
      user: {
        profile: {
          name: 'Nom',
        },
      },
    });
  });

  // ===== NEW BEHAVIOR TESTS ===== //

  it('miss() batches multiple requests within BATCH_INTERVAL', async () => {
    const k1 = makeKey('greeting', 'Hello');
    const k2 = makeKey('farewell', 'Goodbye');

    mockTranslateMany.mockResolvedValue(
      mockTranslateManyResponse([
        { id: k1.id, translation: 'Bonjour' },
        { id: k2.id, translation: 'Au revoir' },
      ])
    );

    const cache = new DictionaryCache({
      init: {},
      translateMany: mockTranslateMany,
    });

    const p1 = cache.miss(k1);
    const p2 = cache.miss(k2);

    expect(mockTranslateMany).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    const [r1, r2] = await Promise.all([p1, p2]);

    expect(r1).toBe('Bonjour');
    expect(r2).toBe('Au revoir');
    expect(mockTranslateMany).toHaveBeenCalledTimes(1);
  });

  it('miss() deduplicates inflight requests for same key', async () => {
    const key = makeKey('greeting', 'Hello');
    mockTranslateMany.mockResolvedValue(
      mockTranslateManyResponse([{ id: key.id, translation: 'Bonjour' }])
    );

    const cache = new DictionaryCache({
      init: {},
      translateMany: mockTranslateMany,
    });

    const p1 = cache.miss(key);
    const p2 = cache.miss(key);

    vi.advanceTimersByTime(50);
    const [r1, r2] = await Promise.all([p1, p2]);

    expect(r1).toBe('Bonjour');
    expect(r2).toBe('Bonjour');
    expect(mockTranslateMany).toHaveBeenCalledTimes(1);
  });
});
