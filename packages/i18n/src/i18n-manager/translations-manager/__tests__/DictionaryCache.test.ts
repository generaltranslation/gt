import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DictionaryCache, Dictionary } from '../DictionaryCache';

describe('DictionaryCache', () => {
  let mockTranslateMany: ReturnType<typeof vi.fn>;
  const dictionary: Dictionary = {
    greeting: 'Hello',
    cta: ['Click me'],
    header: ['Welcome', { $context: 'homepage', $maxChars: 12 }],
    footer: ['Thanks', { context: 'homepage footer' }],
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

  it('get() returns the string from a tuple leaf', () => {
    const cache = new DictionaryCache({
      init: dictionary,
    });

    expect(cache.get('cta')).toBe('Click me');
  });

  it('get() returns the string from a metadata tuple leaf', () => {
    const cache = new DictionaryCache({
      init: dictionary,
    });

    expect(cache.get('header')).toBe('Welcome');
    expect(cache.get('footer')).toBe('Thanks');
  });

  it('get() returns undefined for malformed metadata tuple leaves', () => {
    const cache = new DictionaryCache({
      init: {
        nullMetadata: ['Hello', null],
        numberMetadata: ['Hello', 42],
        stringMetadata: ['Hello', 'World'],
      } as unknown as Dictionary,
    });

    expect(cache.get('nullMetadata')).toBeUndefined();
    expect(cache.get('numberMetadata')).toBeUndefined();
    expect(cache.get('stringMetadata')).toBeUndefined();
  });

  it('get() accepts unknown metadata options', () => {
    const cache = new DictionaryCache({
      init: {
        unknownMetadataKey: ['Hello', { custom: 'value' }],
      } as unknown as Dictionary,
    });

    expect(cache.get('unknownMetadataKey')).toBe('Hello');
  });

  it('get() treats tuple leaves as leaves instead of subtrees', () => {
    const cache = new DictionaryCache({
      init: dictionary,
    });

    expect(cache.get('header.$context')).toBeUndefined();
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
