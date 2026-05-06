import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DictionaryCache, Dictionary } from '../DictionaryCache';

describe('DictionaryCache', () => {
  let mockTranslateMany: ReturnType<typeof vi.fn>;
  const runtimeTranslate = vi.fn();
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
    runtimeTranslate.mockRejectedValue(
      new Error('DictionaryCache fallback is not implemented')
    );
  });

  // ===== REGRESSION TESTS ===== //

  it('get() returns cached dictionary leaf when init is pre-populated', () => {
    const cache = new DictionaryCache({
      init: dictionary,
      runtimeTranslate,
    });

    const result = cache.get('user.profile.name');
    expect(result).toEqual({ entry: 'Name', options: {} });
    expect(mockTranslateMany).not.toHaveBeenCalled();
  });

  it('get() returns the entry from a tuple leaf', () => {
    const cache = new DictionaryCache({
      init: dictionary,
      runtimeTranslate,
    });

    expect(cache.get('cta')).toEqual({ entry: 'Click me', options: {} });
  });

  it('get() returns the entry and options from a metadata tuple leaf', () => {
    const cache = new DictionaryCache({
      init: dictionary,
      runtimeTranslate,
    });

    expect(cache.get('header')).toEqual({
      entry: 'Welcome',
      options: { $context: 'homepage', $maxChars: 12 },
    });
    expect(cache.get('footer')).toEqual({
      entry: 'Thanks',
      options: { context: 'homepage footer' },
    });
  });

  it('get() returns undefined for malformed metadata tuple leaves', () => {
    const cache = new DictionaryCache({
      init: {
        nullMetadata: ['Hello', null],
        numberMetadata: ['Hello', 42],
        stringMetadata: ['Hello', 'World'],
      } as unknown as Dictionary,
      runtimeTranslate,
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
      runtimeTranslate,
    });

    expect(cache.get('unknownMetadataKey')).toEqual({
      entry: 'Hello',
      options: { custom: 'value' },
    });
  });

  it('get() treats tuple leaves as leaves instead of subtrees', () => {
    const cache = new DictionaryCache({
      init: dictionary,
      runtimeTranslate,
    });

    expect(cache.get('header.$context')).toBeUndefined();
  });

  it('get() returns cached dictionary subtree when init is pre-populated', () => {
    const cache = new DictionaryCache({
      init: dictionary,
      runtimeTranslate,
    });

    const result = cache.get('user');
    expect(result).toBeUndefined();
  });

  it('get() returns undefined on cache miss', () => {
    const cache = new DictionaryCache({
      init: dictionary,
      runtimeTranslate,
    });

    const result = cache.get('missing.entry');
    expect(result).toBeUndefined();
  });

  it('set() stores dictionary entries by path', () => {
    const cache = new DictionaryCache({
      init: {},
      runtimeTranslate,
    });

    cache.set('user.profile.name', {
      entry: 'Name',
      options: { $context: 'profile label' },
    });

    expect(cache.getInternalCache()).toEqual({
      user: {
        profile: {
          name: ['Name', { $context: 'profile label' }],
        },
      },
    });
    expect(cache.get('user.profile.name')).toEqual({
      entry: 'Name',
      options: { $context: 'profile label' },
    });
  });

  it('miss() rejects because fallback is not implemented', async () => {
    const cache = new DictionaryCache({
      init: {},
      runtimeTranslate,
    });

    await expect(cache.miss('user.profile.name')).rejects.toThrow(
      'DictionaryCache fallback is not implemented'
    );
    expect(mockTranslateMany).not.toHaveBeenCalled();
    expect(cache.get('user.profile.name')).toBeUndefined();
    expect(cache.getInternalCache()).toEqual({});
  });

  it('miss() stores runtime fallback values by dictionary path', async () => {
    runtimeTranslate.mockResolvedValue('Name');
    const cache = new DictionaryCache({
      init: {},
      runtimeTranslate,
    });

    await expect(cache.miss('user.profile.name')).resolves.toEqual({
      entry: 'Name',
      options: {},
    });
    expect(runtimeTranslate).toHaveBeenCalledWith('user.profile.name');
    expect(cache.getInternalCache()).toEqual({
      user: {
        profile: {
          name: 'Name',
        },
      },
    });
    expect(cache.get('user.profile.name')).toEqual({
      entry: 'Name',
      options: {},
    });
  });

  // ===== NEW BEHAVIOR TESTS ===== //

  it('get() returns undefined for the root dictionary object', () => {
    const cache = new DictionaryCache({
      init: dictionary,
      runtimeTranslate,
    });

    const result = cache.get('');
    expect(result).toBeUndefined();
  });

  it('getObj() returns cached dictionary leaves and subtrees', () => {
    const cache = new DictionaryCache({
      init: dictionary,
      runtimeTranslate,
    });

    expect(cache.getObj('greeting')).toEqual({
      entry: 'Hello',
      options: {},
    });
    expect(cache.getObj('user')).toEqual({
      profile: {
        name: 'Name',
      },
    });
  });

  it('getObj() returns undefined on cache miss', () => {
    const cache = new DictionaryCache({
      init: dictionary,
      runtimeTranslate,
    });

    expect(cache.getObj('missing.entry')).toBeUndefined();
  });

  it('getObj() returns the root dictionary object', () => {
    const cache = new DictionaryCache({
      init: dictionary,
      runtimeTranslate,
    });

    expect(cache.getObj('')).toEqual(dictionary);
  });

  it('setObj() stores dictionary entries by path', () => {
    const cache = new DictionaryCache({
      init: {},
      runtimeTranslate,
    });

    cache.setObj('user.profile.name', {
      entry: 'Name',
      options: { $context: 'profile label' },
    });

    expect(cache.getInternalCache()).toEqual({
      user: {
        profile: {
          name: ['Name', { $context: 'profile label' }],
        },
      },
    });
    expect(cache.getObj('user.profile.name')).toEqual({
      entry: 'Name',
      options: { $context: 'profile label' },
    });
  });

  it('setObj() stores dictionary subtrees by path', () => {
    const cache = new DictionaryCache({
      init: {},
      runtimeTranslate,
    });

    cache.setObj('user.profile', {
      name: 'Name',
      title: ['Title', { $context: 'profile title' }],
    });

    expect(cache.getInternalCache()).toEqual({
      user: {
        profile: {
          name: 'Name',
          title: ['Title', { $context: 'profile title' }],
        },
      },
    });
    expect(cache.getObj('user.profile')).toEqual({
      name: 'Name',
      title: ['Title', { $context: 'profile title' }],
    });
    expect(cache.get('user.profile')).toBeUndefined();
  });
});
