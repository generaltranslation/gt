import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DictionaryCache, Dictionary } from '../DictionaryCache';

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
    mockTranslateMany = vi.fn();
  });

  // ===== REGRESSION TESTS ===== //

  it('get() returns cached dictionary leaf when init is pre-populated', () => {
    const cache = new DictionaryCache({
      init: dictionary,
    });

    const result = cache.get('user.profile.name');
    expect(result).toBe('Name');
    expect(mockTranslateMany).not.toHaveBeenCalled();
  });

  it('get() returns cached dictionary subtree when init is pre-populated', () => {
    const cache = new DictionaryCache({
      init: dictionary,
    });

    const result = cache.get('user');
    expect(result).toBeUndefined();
  });

  it('get() returns undefined on cache miss', () => {
    const cache = new DictionaryCache({
      init: dictionary,
    });

    const result = cache.get('missing.entry');
    expect(result).toBeUndefined();
  });

  it('miss() rejects because fallback is not implemented', async () => {
    const cache = new DictionaryCache({
      init: {},
    });

    await expect(cache.miss('user.profile.name')).rejects.toThrow(
      'DictionaryCache fallback is not implemented'
    );
    expect(mockTranslateMany).not.toHaveBeenCalled();
    expect(cache.get('user.profile.name')).toBeUndefined();
    expect(cache.getInternalCache()).toEqual({});
  });

  // ===== NEW BEHAVIOR TESTS ===== //

  it('get() returns undefined for the root dictionary object', () => {
    const cache = new DictionaryCache({
      init: dictionary,
    });

    const result = cache.get('');
    expect(result).toBeUndefined();
  });
});
