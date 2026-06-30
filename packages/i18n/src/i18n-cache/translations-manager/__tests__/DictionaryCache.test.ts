import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DictionaryCache, Dictionary } from '../DictionaryCache';

describe('DictionaryCache', () => {
  let mockTranslateMany: ReturnType<typeof vi.fn>;
  const runtimeTranslate = vi.fn();
  const dictionary: Dictionary = {
    greeting: 'Hello',
    cta: ['Click me'],
    header: ['Welcome', { $context: 'homepage', $maxChars: 12 }],
    footer: ['Thanks', { $context: 'homepage footer' }],
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

  it('getEntry() returns cached dictionary leaf when init is pre-populated', () => {
    const cache = new DictionaryCache({
      init: dictionary,
      runtimeTranslate,
    });

    const result = cache.getEntry('user.profile.name');
    expect(result).toEqual({ entry: 'Name', options: {} });
    expect(mockTranslateMany).not.toHaveBeenCalled();
  });

  it('getEntry() returns the entry from a tuple leaf', () => {
    const cache = new DictionaryCache({
      init: dictionary,
      runtimeTranslate,
    });

    expect(cache.getEntry('cta')).toEqual({ entry: 'Click me', options: {} });
  });

  it('getEntry() returns the entry and options from a metadata tuple leaf', () => {
    const cache = new DictionaryCache({
      init: dictionary,
      runtimeTranslate,
    });

    expect(cache.getEntry('header')).toEqual({
      entry: 'Welcome',
      options: { $context: 'homepage', $maxChars: 12 },
    });
    expect(cache.getEntry('footer')).toEqual({
      entry: 'Thanks',
      options: { $context: 'homepage footer' },
    });
  });

  it('getEntry() returns copies of cached dictionary options', () => {
    const cache = new DictionaryCache({
      init: dictionary,
      runtimeTranslate,
    });

    const entry = cache.getEntry('header');
    entry!.options.$context = 'changed';

    expect(cache.getEntry('header')).toEqual({
      entry: 'Welcome',
      options: { $context: 'homepage', $maxChars: 12 },
    });
  });

  it('getEntry() returns undefined for malformed metadata tuple leaves', () => {
    const cache = new DictionaryCache({
      init: {
        nullMetadata: ['Hello', null],
        numberMetadata: ['Hello', 42],
        stringMetadata: ['Hello', 'World'],
        invalidFormat: ['Hello', { $format: 42 }],
      } as unknown as Dictionary,
      runtimeTranslate,
    });

    expect(cache.getEntry('nullMetadata')).toBeUndefined();
    expect(cache.getEntry('numberMetadata')).toBeUndefined();
    expect(cache.getEntry('stringMetadata')).toBeUndefined();
    expect(cache.getEntry('invalidFormat')).toBeUndefined();
  });

  it('getEntry() accepts unknown metadata options', () => {
    const cache = new DictionaryCache({
      init: {
        unknownMetadataKey: ['Hello', { custom: 'value' }],
      } as unknown as Dictionary,
      runtimeTranslate,
    });

    expect(cache.getEntry('unknownMetadataKey')).toEqual({
      entry: 'Hello',
      options: { custom: 'value' },
    });
  });

  it('getEntry() treats tuple leaves as leaves instead of subtrees', () => {
    const cache = new DictionaryCache({
      init: dictionary,
      runtimeTranslate,
    });

    expect(cache.getEntry('header.$context')).toBeUndefined();
  });

  it('getEntry() returns cached dictionary subtree when init is pre-populated', () => {
    const cache = new DictionaryCache({
      init: dictionary,
      runtimeTranslate,
    });

    const result = cache.getEntry('user');
    expect(result).toBeUndefined();
  });

  it('getEntry() returns undefined on cache miss', () => {
    const cache = new DictionaryCache({
      init: dictionary,
      runtimeTranslate,
    });

    const result = cache.getEntry('missing.entry');
    expect(result).toBeUndefined();
  });

  it('update() merges the cached dictionary', () => {
    const cache = new DictionaryCache({
      init: dictionary,
      runtimeTranslate,
    });

    const updatedDictionary: Dictionary = {
      greeting: 'Hi',
      user: {
        profile: {
          title: 'Title',
        },
      },
    };
    cache.update(updatedDictionary);
    updatedDictionary.user = {
      profile: {
        title: 'Changed',
      },
    };

    expect(cache.getEntry('greeting')).toEqual({
      entry: 'Hi',
      options: {},
    });
    expect(cache.getEntry('cta')).toEqual({
      entry: 'Click me',
      options: {},
    });
    expect(cache.getEntry('user.profile.name')).toEqual({
      entry: 'Name',
      options: {},
    });
    expect(cache.getEntry('user.profile.title')).toEqual({
      entry: 'Title',
      options: {},
    });
  });

  it('materializeEntry() rejects because fallback is not implemented', async () => {
    const cache = new DictionaryCache({
      init: {},
      runtimeTranslate,
    });

    await expect(
      cache.materializeEntry('user.profile.name', {
        entry: 'Name',
        options: {},
      })
    ).rejects.toThrow('DictionaryCache fallback is not implemented');
    expect(mockTranslateMany).not.toHaveBeenCalled();
    expect(cache.getEntry('user.profile.name')).toBeUndefined();
    expect(cache.getInternalCache()).toEqual({});
  });

  it('materializeEntry() stores runtime fallback values by dictionary path', async () => {
    runtimeTranslate.mockResolvedValue('Name');
    const cache = new DictionaryCache({
      init: {},
      runtimeTranslate,
    });

    const sourceEntry = { entry: 'Name', options: {} };
    await expect(
      cache.materializeEntry('user.profile.name', sourceEntry)
    ).resolves.toEqual({
      entry: 'Name',
      options: {},
    });
    expect(runtimeTranslate).toHaveBeenCalledWith(
      'user.profile.name',
      sourceEntry
    );
    expect(cache.getInternalCache()).toEqual({
      user: {
        profile: {
          name: 'Name',
        },
      },
    });
    expect(cache.getEntry('user.profile.name')).toEqual({
      entry: 'Name',
      options: {},
    });
  });

  it('materializeEntry() deduplicates the translation for concurrent callers', async () => {
    runtimeTranslate.mockClear();
    let resolveTranslation!: (value: string) => void;
    runtimeTranslate.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveTranslation = resolve;
        })
    );
    const cache = new DictionaryCache({
      init: {},
      runtimeTranslate,
    });
    const sourceEntry = { entry: 'Name', options: {} };

    const firstEntry = cache.materializeEntry('user.profile.name', sourceEntry);
    const secondEntry = cache.materializeEntry(
      'user.profile.name',
      sourceEntry
    );
    const thirdEntry = cache.materializeEntry('user.profile.name', sourceEntry);

    expect(runtimeTranslate).toHaveBeenCalledTimes(1);
    resolveTranslation('Name');
    await expect(
      Promise.all([firstEntry, secondEntry, thirdEntry])
    ).resolves.toEqual([
      { entry: 'Name', options: {} },
      { entry: 'Name', options: {} },
      { entry: 'Name', options: {} },
    ]);
  });

  it('materializeEntry() returns independent entries for concurrent callers', async () => {
    let resolveTranslation!: (value: ['Name', { $context: string }]) => void;
    runtimeTranslate.mockImplementation(
      () =>
        new Promise<['Name', { $context: string }]>((resolve) => {
          resolveTranslation = resolve;
        })
    );
    const cache = new DictionaryCache({
      init: {},
      runtimeTranslate,
    });
    const sourceEntry = { entry: 'Name', options: { $context: 'source' } };

    const firstEntry = cache.materializeEntry('user.profile.name', sourceEntry);
    const secondEntry = cache.materializeEntry(
      'user.profile.name',
      sourceEntry
    );

    resolveTranslation(['Name', { $context: 'runtime' }]);
    const [first, second] = await Promise.all([firstEntry, secondEntry]);
    first.options.$context = 'mutated';

    expect(first).not.toBe(second);
    expect(first.options).not.toBe(second.options);
    expect(second.options.$context).toBe('runtime');
    expect(cache.getEntry('user.profile.name')?.options.$context).toBe(
      'runtime'
    );
  });

  it('materializeEntry() rejects unsafe dictionary paths without polluting Object.prototype', async () => {
    runtimeTranslate.mockResolvedValue('Value');
    const cache = new DictionaryCache({
      init: {},
      runtimeTranslate,
    });

    await expect(
      cache.materializeEntry('__proto__.polluted', {
        entry: 'Value',
        options: {},
      })
    ).rejects.toThrow(
      'Dictionary path "__proto__.polluted" contains an unsafe segment'
    );
    expect(({} as { polluted?: string }).polluted).toBeUndefined();
    expect(cache.getInternalCache()).toEqual({});
  });

  it('materializeValue() rejects unsafe target-only root keys without mutating the cache prototype', async () => {
    const cache = new DictionaryCache({
      init: {},
      runtimeTranslate,
    });
    const targetValue = JSON.parse(
      '{"__proto__":{"polluted":"yes"}}'
    ) as Dictionary;

    await expect(cache.materializeValue('', {}, targetValue)).rejects.toThrow(
      'Dictionary path "__proto__" contains an unsafe segment'
    );

    expect(cache.getValue('polluted')).toBeUndefined();
    expect(({} as { polluted?: string }).polluted).toBeUndefined();
    expect(cache.getInternalCache()).toEqual({});
  });

  it('materializeValue() rejects unsafe target subtrees under safe source leaves', async () => {
    const cache = new DictionaryCache({
      init: {},
      runtimeTranslate,
    });
    const targetValue = JSON.parse(
      '{"__proto__":{"polluted":"yes"}}'
    ) as Dictionary;

    await expect(
      cache.materializeValue('safe', 'Source', targetValue)
    ).rejects.toThrow(
      'Dictionary path "safe.__proto__" contains an unsafe segment'
    );

    expect(cache.getValue('safe')).toBeUndefined();
    expect(({} as { polluted?: string }).polluted).toBeUndefined();
  });

  // ===== NEW BEHAVIOR TESTS ===== //

  it('getEntry() returns undefined for the root dictionary object', () => {
    const cache = new DictionaryCache({
      init: dictionary,
      runtimeTranslate,
    });

    const result = cache.getEntry('');
    expect(result).toBeUndefined();
  });

  it('getValue() returns cached dictionary leaves and subtrees', () => {
    const cache = new DictionaryCache({
      init: dictionary,
      runtimeTranslate,
    });

    expect(cache.getValue('greeting')).toBe('Hello');
    expect(cache.getValue('header')).toEqual([
      'Welcome',
      { $context: 'homepage', $maxChars: 12 },
    ]);
    expect(cache.getValue('user')).toEqual({
      profile: {
        name: 'Name',
      },
    });
  });

  it('getValue() returns undefined on cache miss', () => {
    const cache = new DictionaryCache({
      init: dictionary,
      runtimeTranslate,
    });

    expect(cache.getValue('missing.entry')).toBeUndefined();
  });

  it('getValue() returns the root dictionary object', () => {
    const cache = new DictionaryCache({
      init: dictionary,
      runtimeTranslate,
    });

    expect(cache.getValue('')).toEqual(dictionary);
  });

  it('getValue() returns copies of cached dictionary objects', () => {
    const cache = new DictionaryCache({
      init: dictionary,
      runtimeTranslate,
    });

    const user = cache.getValue('user') as Dictionary;
    user.profile = {
      name: 'Changed',
    };

    expect(cache.getValue('user')).toEqual({
      profile: {
        name: 'Name',
      },
    });
  });

  it('setValue() stores dictionary leaves by path', () => {
    const cache = new DictionaryCache({
      init: {},
      runtimeTranslate,
    });

    cache.setValue('user.profile.name', [
      'Name',
      { $context: 'profile label' },
    ]);

    expect(cache.getInternalCache()).toEqual({
      user: {
        profile: {
          name: ['Name', { $context: 'profile label' }],
        },
      },
    });
    expect(cache.getValue('user.profile.name')).toEqual([
      'Name',
      { $context: 'profile label' },
    ]);
  });

  it('setValue() stores entry-shaped dictionary subtrees by path', () => {
    const cache = new DictionaryCache({
      init: {},
      runtimeTranslate,
    });

    cache.setValue('content', {
      entry: 'Entry label',
      options: {},
    });

    expect(cache.getInternalCache()).toEqual({
      content: {
        entry: 'Entry label',
        options: {},
      },
    });
    expect(cache.getValue('content')).toEqual({
      entry: 'Entry label',
      options: {},
    });
    expect(cache.getValue('content.entry')).toBe('Entry label');
  });

  it('setValue() stores dictionary subtrees by path', () => {
    const cache = new DictionaryCache({
      init: {},
      runtimeTranslate,
    });

    cache.setValue('user.profile', {
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
    expect(cache.getValue('user.profile')).toEqual({
      name: 'Name',
      title: ['Title', { $context: 'profile title' }],
    });
    expect(cache.getEntry('user.profile')).toBeUndefined();
  });

  it('setValue() stores copies of dictionary objects', () => {
    const cache = new DictionaryCache({
      init: {},
      runtimeTranslate,
    });
    const value: Dictionary = {
      profile: {
        name: 'Name',
      },
    };

    cache.setValue('user', value);
    value.profile = {
      name: 'Changed',
    };

    expect(cache.getValue('user')).toEqual({
      profile: {
        name: 'Name',
      },
    });
  });

  it('materializeValue() stores runtime fallback dictionary entries by path', async () => {
    runtimeTranslate.mockResolvedValue('Name');
    const cache = new DictionaryCache({
      init: {},
      runtimeTranslate,
    });
    const sourceEntry = { entry: 'Name', options: {} };

    await expect(
      cache.materializeValue('user.profile.name', 'Name')
    ).resolves.toBe('Name');
    expect(runtimeTranslate).toHaveBeenCalledWith(
      'user.profile.name',
      sourceEntry
    );
    expect(cache.getInternalCache()).toEqual({
      user: {
        profile: {
          name: 'Name',
        },
      },
    });
  });

  it('materializeValue() stores runtime fallback dictionary subtrees by path', async () => {
    runtimeTranslate.mockImplementation(async (key) => {
      if (key === 'user.profile.name') {
        return 'Nom';
      }
      if (key === 'user.profile.title') {
        return 'Titre';
      }
      throw new Error(`Unexpected key: ${key}`);
    });
    const cache = new DictionaryCache({
      init: {},
      runtimeTranslate,
    });
    const sourceObject = {
      name: 'Name',
      title: 'Title',
    };

    await expect(
      cache.materializeValue('user.profile', sourceObject)
    ).resolves.toEqual({
      name: 'Nom',
      title: 'Titre',
    });
    expect(runtimeTranslate).toHaveBeenCalledWith('user.profile.name', {
      entry: 'Name',
      options: {},
    });
    expect(runtimeTranslate).toHaveBeenCalledWith('user.profile.title', {
      entry: 'Title',
      options: {},
    });
    expect(cache.getInternalCache()).toEqual({
      user: {
        profile: {
          name: 'Nom',
          title: 'Titre',
        },
      },
    });
  });

  it('materializeValue() deduplicates concurrent subtree materializations', async () => {
    runtimeTranslate.mockClear();
    runtimeTranslate.mockImplementation(async (key) => {
      if (key === 'user.profile.name') {
        return 'Nom';
      }
      if (key === 'user.profile.title') {
        return 'Titre';
      }
      throw new Error(`Unexpected key: ${key}`);
    });
    const cache = new DictionaryCache({
      init: {},
      runtimeTranslate,
    });
    const setValueSpy = vi.spyOn(cache, 'setValue');
    const sourceObject = {
      name: 'Name',
      title: 'Title',
    };
    const expectedValue = {
      name: 'Nom',
      title: 'Titre',
    };

    await expect(
      Promise.all([
        cache.materializeValue('user.profile', sourceObject),
        cache.materializeValue('user.profile', sourceObject),
        cache.materializeValue('user.profile', sourceObject),
      ])
    ).resolves.toEqual([expectedValue, expectedValue, expectedValue]);

    expect(runtimeTranslate).toHaveBeenCalledTimes(2);
    expect(setValueSpy).toHaveBeenCalledTimes(1);
    expect(setValueSpy).toHaveBeenCalledWith('user.profile', expectedValue);
    expect(cache.getInternalCache()).toEqual({
      user: {
        profile: {
          name: 'Nom',
          title: 'Titre',
        },
      },
    });
  });
});
