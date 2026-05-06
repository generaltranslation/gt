import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { I18nManager } from '../I18nManager';
import { createTranslateManyFactory } from '../translations-manager/utils/createTranslateMany';
import { hashMessage } from '../../utils/hashMessage';
import { LookupOptions } from '../../translation-functions/types/options';

// Mock createTranslateManyFactory to inject a controlled translateMany
const mockTranslateMany = vi.fn();
vi.mock('../translations-manager/utils/createTranslateMany', () => ({
  createTranslateManyFactory: vi.fn().mockReturnValue(() => mockTranslateMany),
}));

// Test data
const message = 'Hello {name}!';
const lookupOptions: LookupOptions = {
  $format: 'ICU',
  $context: 'greeting',
};
const expectedHash = hashMessage(message, lookupOptions);
const translatedString = 'Bonjour {name} !';

function createManager(overrides: Record<string, unknown> = {}) {
  return new I18nManager({
    defaultLocale: 'en',
    locales: ['en', 'fr', 'es'],
    loadTranslations: vi
      .fn()
      .mockResolvedValue({ [expectedHash]: translatedString }),
    ...overrides,
  });
}

function getDictionaryRuntimeTranslate(
  manager: ReturnType<typeof createManager>
) {
  return manager as unknown as {
    dictionaryRuntimeTranslate(locale: string, id: string): Promise<string>;
    dictionaryRuntimeTranslateObj(locale: string, id: string): Promise<unknown>;
  };
}

describe('I18nManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTranslateMany.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ===== REGRESSION TESTS ===== //

  it('resolveTranslationSync returns translation after loadTranslations', async () => {
    const manager = createManager();

    // Load translations first
    await manager.loadTranslations('fr');

    // Now sync resolution should work
    const result = manager.resolveTranslationSync('fr', message, lookupOptions);
    expect(result).toBe(translatedString);
  });

  it('getTranslations returns empty object for invalid locale', async () => {
    const manager = createManager();

    const result = await manager.getTranslations('zh');
    expect(result).toEqual({});
  });

  it('getTranslationResolver returns a working resolver function', async () => {
    const manager = createManager();

    const resolver = await manager.getTranslationResolver('fr');
    const result = resolver(message, lookupOptions);

    expect(result).toBe(translatedString);
  });

  // ===== NEW BEHAVIOR TESTS ===== //

  it('loadTranslations() returns Record<Hash, Translation>', async () => {
    const manager = createManager();

    const translations = await manager.loadTranslations('fr');

    expect(translations[expectedHash]).toBe(translatedString);
  });

  it('loadDictionary() returns source dictionary without loading when locale does not require translation', async () => {
    const loadDictionary = vi.fn().mockResolvedValue({ greeting: 'Bonjour' });
    const manager = createManager({
      dictionary: {
        greeting: 'Hello',
      },
      loadDictionary,
    });

    const dictionary = await manager.loadDictionary('en');

    expect(dictionary).toEqual({
      greeting: 'Hello',
    });
    expect(loadDictionary).not.toHaveBeenCalled();
  });

  it('loadDictionary() returns source dictionary without loading when i18n is disabled', async () => {
    const loadDictionary = vi.fn().mockResolvedValue({ greeting: 'Bonjour' });
    const manager = createManager({
      enableI18n: false,
      dictionary: {
        greeting: 'Hello',
      },
      loadDictionary,
    });

    const dictionary = await manager.loadDictionary('fr');

    expect(dictionary).toEqual({
      greeting: 'Hello',
    });
    expect(loadDictionary).not.toHaveBeenCalled();
  });

  it('loadDictionary() loads and caches dictionary for requested locale', async () => {
    const loadDictionary = vi.fn().mockResolvedValue({
      greeting: 'Bonjour',
      user: {
        name: 'Nom',
      },
    });
    const manager = createManager({
      dictionary: {
        greeting: 'Hello',
      },
      loadDictionary,
    });

    const dictionary = await manager.loadDictionary('fr');
    const cachedDictionary = await manager.loadDictionary('fr');

    expect(loadDictionary).toHaveBeenCalledTimes(1);
    expect(loadDictionary).toHaveBeenCalledWith('fr');
    expect(dictionary).toEqual({
      greeting: 'Bonjour',
      user: {
        name: 'Nom',
      },
    });
    expect(cachedDictionary).toBe(dictionary);
  });

  it.each([
    {
      name: 'dialect locale',
      locale: 'en-GB',
      dictionaryLocale: 'en-GB',
      dictionary: {
        greeting: 'Hello mate',
      },
    },
    {
      name: 'canonical locale with custom alias',
      locale: 'en-GB',
      dictionaryLocale: 'brand-british',
      dictionary: {
        greeting: 'Brand hello mate',
      },
      customMapping: {
        'brand-british': {
          code: 'en-GB',
          name: 'Brand British',
        },
      },
    },
  ])('loadDictionary() uses cache locale for $name', async (testCase) => {
    const loadDictionary = vi.fn().mockResolvedValue(testCase.dictionary);
    const manager = createManager({
      defaultLocale: 'en-US',
      locales: ['en-US', 'en'],
      dictionary: {
        greeting: 'Hello',
      },
      loadDictionary,
      ...(testCase.customMapping && {
        customMapping: testCase.customMapping,
      }),
    });

    const dictionary = await manager.loadDictionary(testCase.locale);

    expect(loadDictionary).toHaveBeenCalledTimes(1);
    expect(loadDictionary).toHaveBeenCalledWith(testCase.dictionaryLocale);
    expect(dictionary).toEqual(testCase.dictionary);
    expect(manager.lookupDictionary(testCase.locale, 'greeting')).toEqual({
      entry: testCase.dictionary.greeting,
      options: {},
    });
  });

  it('lookupDictionary() returns a loaded target locale leaf', async () => {
    const manager = createManager({
      dictionary: {
        greeting: 'Hello',
      },
      loadDictionary: vi.fn().mockResolvedValue({
        greeting: 'Bonjour',
      }),
    });

    await manager.loadDictionary('fr');

    expect(manager.lookupDictionary('fr', 'greeting')).toEqual({
      entry: 'Bonjour',
      options: {},
    });
  });

  it('lookupDictionary() returns a loaded target locale nested leaf', async () => {
    const manager = createManager({
      dictionary: {
        user: {
          name: 'Name',
        },
      },
      loadDictionary: vi.fn().mockResolvedValue({
        user: {
          name: 'Nom',
        },
      }),
    });

    await manager.loadDictionary('fr');

    expect(manager.lookupDictionary('fr', 'user.name')).toEqual({
      entry: 'Nom',
      options: {},
    });
  });

  it('lookupDictionary() returns the entry and options from a metadata tuple leaf', async () => {
    const manager = createManager({
      dictionary: {
        greeting: ['Hello', { $context: 'homepage', $maxChars: 10 }],
      },
      loadDictionary: vi.fn().mockResolvedValue({
        greeting: ['Bonjour', { context: 'homepage' }],
      }),
    });

    await manager.loadDictionary('fr');

    expect(manager.lookupDictionary('fr', 'greeting')).toEqual({
      entry: 'Bonjour',
      options: { context: 'homepage' },
    });
  });

  it('lookupDictionary() returns undefined when target locale is not loaded', () => {
    const manager = createManager({
      dictionary: {
        greeting: 'Hello',
      },
      loadDictionary: vi.fn().mockResolvedValue({
        greeting: 'Bonjour',
      }),
    });

    expect(manager.lookupDictionary('fr', 'greeting')).toBeUndefined();
    expect(manager.lookupDictionary('en', 'greeting')).toEqual({
      entry: 'Hello',
      options: {},
    });
  });

  it('lookupDictionary() returns undefined when source leaf is missing and translation is not required', () => {
    const manager = createManager({
      dictionary: {
        greeting: 'Hello',
      },
    });

    expect(manager.lookupDictionary('en', 'missing')).toBeUndefined();
  });

  it('lookupDictionary() returns undefined when source leaf is missing and i18n is disabled', () => {
    const manager = createManager({
      enableI18n: false,
      dictionary: {
        greeting: 'Hello',
      },
    });

    expect(manager.lookupDictionary('fr', 'missing')).toBeUndefined();
  });

  it('lookupDictionary() returns undefined when target leaf is missing', async () => {
    const manager = createManager({
      dictionary: {
        greeting: 'Hello',
      },
      loadDictionary: vi.fn().mockResolvedValue({}),
    });

    await manager.loadDictionary('fr');

    expect(manager.lookupDictionary('fr', 'greeting')).toBeUndefined();
    expect(manager.lookupDictionary('en', 'greeting')).toEqual({
      entry: 'Hello',
      options: {},
    });
  });

  it('lookupDictionary() returns undefined when target nested leaf is missing', async () => {
    const manager = createManager({
      dictionary: {
        user: {
          name: 'Name',
        },
      },
      loadDictionary: vi.fn().mockResolvedValue({
        user: {},
      }),
    });

    await manager.loadDictionary('fr');

    expect(manager.lookupDictionary('fr', 'user.name')).toBeUndefined();
    expect(manager.lookupDictionary('en', 'user.name')).toEqual({
      entry: 'Name',
      options: {},
    });
  });

  it('lookupDictionary() does not return dictionary subtrees', async () => {
    const manager = createManager({
      dictionary: {
        user: {
          name: 'Name',
        },
      },
      loadDictionary: vi.fn().mockResolvedValue({
        user: {
          name: 'Nom',
        },
      }),
    });

    await manager.loadDictionary('fr');

    expect(manager.lookupDictionary('fr', 'user')).toBeUndefined();
  });

  it('lookupDictionaryObj() returns source leaves and subtrees', () => {
    const manager = createManager({
      dictionary: {
        greeting: 'Hello',
        user: {
          profile: {
            name: 'Name',
          },
        },
      },
    });

    expect(manager.lookupDictionaryObj('en', 'greeting')).toEqual({
      entry: 'Hello',
      options: {},
    });
    expect(manager.lookupDictionaryObj('en', 'user.profile')).toEqual({
      name: 'Name',
    });
  });

  it('lookupDictionaryObj() returns loaded target leaves and subtrees', async () => {
    const manager = createManager({
      dictionary: {
        greeting: 'Hello',
      },
      loadDictionary: vi.fn().mockResolvedValue({
        greeting: 'Bonjour',
        user: {
          profile: {
            name: 'Nom',
          },
        },
      }),
    });

    await manager.loadDictionary('fr');

    expect(manager.lookupDictionaryObj('fr', 'greeting')).toEqual({
      entry: 'Bonjour',
      options: {},
    });
    expect(manager.lookupDictionaryObj('fr', 'user.profile')).toEqual({
      name: 'Nom',
    });
  });

  it('lookupDictionaryObj() returns undefined when target locale is not loaded', () => {
    const manager = createManager({
      dictionary: {
        user: {
          profile: {
            name: 'Name',
          },
        },
      },
      loadDictionary: vi.fn().mockResolvedValue({
        user: {
          profile: {
            name: 'Nom',
          },
        },
      }),
    });

    expect(manager.lookupDictionaryObj('fr', 'user.profile')).toBeUndefined();
  });

  it('lookupDictionaryObj() returns undefined for missing paths', async () => {
    const manager = createManager({
      dictionary: {
        greeting: 'Hello',
      },
      loadDictionary: vi.fn().mockResolvedValue({
        greeting: 'Bonjour',
      }),
    });

    await manager.loadDictionary('fr');

    expect(manager.lookupDictionaryObj('fr', 'missing')).toBeUndefined();
    expect(manager.lookupDictionaryObj('en', 'missing')).toBeUndefined();
  });

  it('lookupDictionaryObj() uses the source dictionary when i18n is disabled', () => {
    const manager = createManager({
      enableI18n: false,
      dictionary: {
        user: {
          profile: {
            name: 'Name',
          },
        },
      },
      loadDictionary: vi.fn().mockResolvedValue({
        user: {
          profile: {
            name: 'Nom',
          },
        },
      }),
    });

    expect(manager.lookupDictionaryObj('fr', 'user.profile')).toEqual({
      name: 'Name',
    });
  });

  it('lookupDictionaryWithFallback() returns the source dictionary entry when translation is not required', async () => {
    const loadDictionary = vi.fn().mockResolvedValue({
      greeting: 'Bonjour',
    });
    const manager = createManager({
      dictionary: {
        greeting: 'Hello',
      },
      loadDictionary,
    });

    await expect(
      manager.lookupDictionaryWithFallback('en', 'greeting')
    ).resolves.toEqual({
      entry: 'Hello',
      options: {},
    });
    expect(loadDictionary).not.toHaveBeenCalled();
  });

  it('lookupDictionaryWithFallback() throws when source entry is missing and translation is not required', async () => {
    const manager = createManager({
      dictionary: {
        greeting: 'Hello',
      },
      loadDictionary: vi.fn().mockResolvedValue({
        greeting: 'Bonjour',
      }),
    });

    await expect(
      manager.lookupDictionaryWithFallback('en', 'missing')
    ).rejects.toThrow(
      'I18nManager: source dictionary entry missing is not defined'
    );
  });

  it('lookupDictionaryWithFallback() returns the source dictionary entry when i18n is disabled', async () => {
    const loadDictionary = vi.fn().mockResolvedValue({
      greeting: 'Bonjour',
    });
    const manager = createManager({
      enableI18n: false,
      dictionary: {
        greeting: 'Hello',
      },
      loadDictionary,
    });

    await expect(
      manager.lookupDictionaryWithFallback('fr', 'greeting')
    ).resolves.toEqual({
      entry: 'Hello',
      options: {},
    });
    expect(loadDictionary).not.toHaveBeenCalled();
  });

  it('lookupDictionaryWithFallback() loads and returns a target dictionary entry', async () => {
    const loadDictionary = vi.fn().mockResolvedValue({
      greeting: 'Bonjour',
    });
    const manager = createManager({
      dictionary: {
        greeting: 'Hello',
      },
      loadDictionary,
    });

    await expect(
      manager.lookupDictionaryWithFallback('fr', 'greeting')
    ).resolves.toEqual({
      entry: 'Bonjour',
      options: {},
    });
    expect(loadDictionary).toHaveBeenCalledTimes(1);
    expect(loadDictionary).toHaveBeenCalledWith('fr');
  });

  it.each([
    {
      name: 'dialect locale',
      locale: 'en-GB',
      dictionaryLocale: 'en-GB',
      dictionary: {
        greeting: 'Hello mate',
      },
    },
    {
      name: 'canonical locale with custom alias',
      locale: 'en-GB',
      dictionaryLocale: 'brand-british',
      dictionary: {
        greeting: 'Brand hello mate',
      },
      customMapping: {
        'brand-british': {
          code: 'en-GB',
          name: 'Brand British',
        },
      },
    },
  ])(
    'lookupDictionaryWithFallback() uses cache locale for $name',
    async (testCase) => {
      const loadDictionary = vi.fn().mockResolvedValue(testCase.dictionary);
      const manager = createManager({
        defaultLocale: 'en-US',
        locales: ['en-US', 'en'],
        dictionary: {
          greeting: 'Hello',
        },
        loadDictionary,
        ...(testCase.customMapping && {
          customMapping: testCase.customMapping,
        }),
      });

      await expect(
        manager.lookupDictionaryWithFallback(testCase.locale, 'greeting')
      ).resolves.toEqual({
        entry: testCase.dictionary.greeting,
        options: {},
      });
      expect(loadDictionary).toHaveBeenCalledTimes(1);
      expect(loadDictionary).toHaveBeenCalledWith(testCase.dictionaryLocale);
    }
  );

  it('lookupDictionaryWithFallback() runtime translates and caches missing dictionary entries', async () => {
    const source = 'Hello';
    const sourceOptions: LookupOptions = { $format: 'ICU' };
    const sourceHash = hashMessage(source, sourceOptions);
    const manager = createManager({
      dictionary: {
        greeting: source,
      },
      loadDictionary: vi.fn().mockResolvedValue({}),
      runtimeTranslation: {},
    });

    mockTranslateMany.mockResolvedValue({
      [sourceHash]: {
        success: true,
        translation: 'Bonjour',
      },
    });

    await expect(
      manager.lookupDictionaryWithFallback('fr', 'greeting')
    ).resolves.toEqual({
      entry: 'Bonjour',
      options: {},
    });
    expect(manager.lookupDictionary('fr', 'greeting')).toEqual({
      entry: 'Bonjour',
      options: {},
    });
  });

  it('lookupDictionaryWithFallback() throws when source dictionary entry is missing', async () => {
    const manager = createManager({
      dictionary: {
        greeting: 'Hello',
      },
      loadDictionary: vi.fn().mockResolvedValue({}),
      runtimeTranslation: {},
    });

    await expect(
      manager.lookupDictionaryWithFallback('fr', 'missing')
    ).rejects.toThrow(
      'I18nManager: source dictionary entry missing is not defined'
    );
  });

  it('lookupDictionaryObjWithFallback() returns source leaves and subtrees when translation is not required', async () => {
    const loadDictionary = vi.fn().mockResolvedValue({
      user: {
        profile: {
          name: 'Nom',
        },
      },
    });
    const manager = createManager({
      dictionary: {
        greeting: 'Hello',
        user: {
          profile: {
            name: 'Name',
          },
        },
      },
      loadDictionary,
    });

    await expect(
      manager.lookupDictionaryObjWithFallback('en', 'greeting')
    ).resolves.toEqual({
      entry: 'Hello',
      options: {},
    });
    await expect(
      manager.lookupDictionaryObjWithFallback('en', 'user.profile')
    ).resolves.toEqual({
      name: 'Name',
    });
    expect(loadDictionary).not.toHaveBeenCalled();
  });

  it('lookupDictionaryObjWithFallback() returns source subtrees when i18n is disabled', async () => {
    const loadDictionary = vi.fn().mockResolvedValue({
      user: {
        profile: {
          name: 'Nom',
        },
      },
    });
    const manager = createManager({
      enableI18n: false,
      dictionary: {
        user: {
          profile: {
            name: 'Name',
          },
        },
      },
      loadDictionary,
    });

    await expect(
      manager.lookupDictionaryObjWithFallback('fr', 'user.profile')
    ).resolves.toEqual({
      name: 'Name',
    });
    expect(loadDictionary).not.toHaveBeenCalled();
  });

  it('lookupDictionaryObjWithFallback() loads and returns a target dictionary subtree', async () => {
    const loadDictionary = vi.fn().mockResolvedValue({
      user: {
        profile: {
          name: 'Nom',
        },
      },
    });
    const manager = createManager({
      dictionary: {
        user: {
          profile: {
            name: 'Name',
          },
        },
      },
      loadDictionary,
    });

    await expect(
      manager.lookupDictionaryObjWithFallback('fr', 'user.profile')
    ).resolves.toEqual({
      name: 'Nom',
    });
    expect(loadDictionary).toHaveBeenCalledTimes(1);
    expect(loadDictionary).toHaveBeenCalledWith('fr');
  });

  it('lookupDictionaryObjWithFallback() runtime translates and caches missing dictionary subtrees', async () => {
    const name = 'Name';
    const title = 'Title';
    const nameHash = hashMessage(name, { $format: 'ICU' });
    const titleHash = hashMessage(title, { $format: 'ICU' });
    const manager = createManager({
      dictionary: {
        user: {
          profile: {
            name,
            title,
          },
        },
      },
      loadDictionary: vi.fn().mockResolvedValue({}),
      runtimeTranslation: {},
    });

    mockTranslateMany.mockResolvedValue({
      [nameHash]: {
        success: true,
        translation: 'Nom',
      },
      [titleHash]: {
        success: true,
        translation: 'Titre',
      },
    });

    await expect(
      manager.lookupDictionaryObjWithFallback('fr', 'user.profile')
    ).resolves.toEqual({
      name: 'Nom',
      title: 'Titre',
    });
    expect(manager.lookupDictionaryObj('fr', 'user.profile')).toEqual({
      name: 'Nom',
      title: 'Titre',
    });
  });

  it('lookupDictionaryObjWithFallback() throws when source dictionary object is missing', async () => {
    const manager = createManager({
      dictionary: {
        greeting: 'Hello',
      },
      loadDictionary: vi.fn().mockResolvedValue({}),
      runtimeTranslation: {},
    });

    await expect(
      manager.lookupDictionaryObjWithFallback('fr', 'missing')
    ).rejects.toThrow(
      'I18nManager: source dictionary entry missing is not defined'
    );
  });

  it.each([
    {
      name: 'dialect locale',
      locale: 'en-GB',
      dictionaryLocale: 'en-GB',
      dictionary: {
        user: {
          profile: {
            name: 'Mate',
          },
        },
      },
    },
    {
      name: 'canonical locale with custom alias',
      locale: 'en-GB',
      dictionaryLocale: 'brand-british',
      dictionary: {
        user: {
          profile: {
            name: 'Brand mate',
          },
        },
      },
      customMapping: {
        'brand-british': {
          code: 'en-GB',
          name: 'Brand British',
        },
      },
    },
  ])(
    'lookupDictionaryObjWithFallback() uses cache locale for $name',
    async (testCase) => {
      const loadDictionary = vi.fn().mockResolvedValue(testCase.dictionary);
      const manager = createManager({
        defaultLocale: 'en-US',
        locales: ['en-US', 'en'],
        dictionary: {
          user: {
            profile: {
              name: 'Name',
            },
          },
        },
        loadDictionary,
        ...(testCase.customMapping && {
          customMapping: testCase.customMapping,
        }),
      });

      await expect(
        manager.lookupDictionaryObjWithFallback(testCase.locale, 'user.profile')
      ).resolves.toEqual(testCase.dictionary.user.profile);
      expect(loadDictionary).toHaveBeenCalledTimes(1);
      expect(loadDictionary).toHaveBeenCalledWith(testCase.dictionaryLocale);
    }
  );

  it('lookupTranslation() returns undefined before load, translation after', async () => {
    const manager = createManager();

    // Before loading
    const before = manager.lookupTranslation('fr', message, lookupOptions);
    expect(before).toBeUndefined();

    // Load translations
    await manager.loadTranslations('fr');

    // After loading
    const after = manager.lookupTranslation('fr', message, lookupOptions);
    expect(after).toBe(translatedString);
  });

  it.each([
    {
      name: 'expires',
      cacheExpiryTime: 100,
      advanceBy: 101,
      lookupAfter: undefined,
      reloaded: 'Salut {name} !',
      calls: 2,
    },
    {
      name: 'keeps',
      cacheExpiryTime: null,
      advanceBy: 60_001,
      lookupAfter: translatedString,
      reloaded: translatedString,
      calls: 1,
    },
  ])('$name locale caches according to cacheExpiryTime', async (testCase) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const loadTranslations = vi
      .fn()
      .mockResolvedValueOnce({ [expectedHash]: translatedString })
      .mockResolvedValueOnce({ [expectedHash]: 'Salut {name} !' });
    const manager = createManager({
      cacheExpiryTime: testCase.cacheExpiryTime,
      loadTranslations,
    });

    await manager.loadTranslations('fr');
    expect(manager.lookupTranslation('fr', message, lookupOptions)).toBe(
      translatedString
    );

    vi.advanceTimersByTime(testCase.advanceBy);
    expect(manager.lookupTranslation('fr', message, lookupOptions)).toBe(
      testCase.lookupAfter
    );

    const translations = await manager.loadTranslations('fr');
    expect(translations[expectedHash]).toBe(testCase.reloaded);
    expect(loadTranslations).toHaveBeenCalledTimes(testCase.calls);
  });

  it.each([
    {
      name: 'requested dialect locale',
      locale: 'en-GB',
      translationLocale: 'en-GB',
      translation: 'Hello there {name}!',
    },
    {
      name: 'custom alias locale',
      locale: 'brand-british',
      translationLocale: 'brand-british',
      translation: 'Hello mate {name}!',
      customMapping: {
        'brand-british': {
          code: 'en-GB',
          name: 'Brand British',
        },
      },
    },
    {
      name: 'canonical locale with custom alias',
      locale: 'en-GB',
      translationLocale: 'brand-british',
      translation: 'Hello mate {name}!',
      customMapping: {
        'brand-british': {
          code: 'en-GB',
          name: 'Brand British',
        },
      },
    },
  ])(
    'uses $name cache key when approved fallback is source-equivalent',
    async (testCase) => {
      const loadTranslations = vi
        .fn()
        .mockResolvedValue({ [expectedHash]: testCase.translation });
      const manager = createManager({
        defaultLocale: 'en-US',
        locales: ['en-US', 'en'],
        loadTranslations,
        ...(testCase.customMapping && {
          customMapping: testCase.customMapping,
        }),
      });

      expect(manager.requiresTranslation('en-GB')).toBe(true);
      expect(manager.requiresDialectTranslation('en-GB')).toBe(true);

      const translations = await manager.loadTranslations(testCase.locale);

      expect(loadTranslations).toHaveBeenCalledTimes(1);
      expect(loadTranslations).toHaveBeenCalledWith(testCase.translationLocale);
      expect(translations[expectedHash]).toBe(testCase.translation);
      expect(
        manager.lookupTranslation(testCase.locale, message, lookupOptions)
      ).toBe(testCase.translation);
    }
  );

  it('lookupTranslationWithFallback() falls back to runtime translate on cache miss', async () => {
    const unknownMessage = 'Unknown message';
    const unknownOptions: LookupOptions = { $format: 'ICU' };
    const unknownHash = hashMessage(unknownMessage, unknownOptions);

    // loadTranslations returns translations that do NOT include unknownMessage
    const manager = createManager({
      runtimeTranslation: {
        timeout: 4321,
        metadata: {
          sourceLocale: 'en',
          projectId: 'project-id',
          publish: true,
        },
      },
    });

    // Mock translateMany to return a translation for the unknown message
    mockTranslateMany.mockResolvedValue({
      [unknownHash]: {
        success: true,
        translation: 'Message inconnu',
      },
    });

    const result = await manager.lookupTranslationWithFallback(
      'fr',
      unknownMessage,
      unknownOptions
    );

    expect(result).toBe('Message inconnu');
    expect(mockTranslateMany).toHaveBeenCalled();
    expect(createTranslateManyFactory).toHaveBeenCalledWith(
      expect.any(Object),
      4321,
      {
        sourceLocale: 'en',
        projectId: 'project-id',
        publish: true,
      }
    );
  });

  it('dictionaryRuntimeTranslate() rejects when source dictionary entry is missing', async () => {
    const manager = createManager({
      dictionary: {
        greeting: 'Hello',
      },
    });
    const runtimeTranslate = getDictionaryRuntimeTranslate(manager);

    await expect(
      runtimeTranslate.dictionaryRuntimeTranslate('fr', 'missing')
    ).rejects.toThrow(
      'I18nManager: source dictionary entry missing is not defined'
    );
  });

  it('dictionaryRuntimeTranslate() respects source dictionary format options', async () => {
    const source = 'Hello {name}';
    const sourceOptions: LookupOptions = {
      $format: 'I18NEXT',
      $context: 'homepage',
    };
    const sourceHash = hashMessage(source, sourceOptions);
    const manager = createManager({
      dictionary: {
        greeting: [source, { $format: 'I18NEXT', context: 'homepage' }],
      },
      runtimeTranslation: {},
    });
    const runtimeTranslate = getDictionaryRuntimeTranslate(manager);

    mockTranslateMany.mockResolvedValue({
      [sourceHash]: {
        success: true,
        translation: 'Bonjour {name}',
      },
    });

    await expect(
      runtimeTranslate.dictionaryRuntimeTranslate('fr', 'greeting')
    ).resolves.toBe('Bonjour {name}');
  });

  it('dictionaryRuntimeTranslate() rejects when runtime translation is not a string', async () => {
    const source = 'Hello';
    const sourceOptions: LookupOptions = { $format: 'ICU' };
    const sourceHash = hashMessage(source, sourceOptions);
    const manager = createManager({
      dictionary: {
        greeting: source,
      },
      runtimeTranslation: {},
    });
    const runtimeTranslate = getDictionaryRuntimeTranslate(manager);

    mockTranslateMany.mockResolvedValue({
      [sourceHash]: {
        success: true,
        translation: ['Bonjour'],
      },
    });

    await expect(
      runtimeTranslate.dictionaryRuntimeTranslate('fr', 'greeting')
    ).rejects.toThrow(
      'I18nManager: dictionaryRuntimeTranslate(): unable to translate dictionary entry greeting'
    );
  });

  it('dictionaryRuntimeTranslateObj() translates source dictionary subtrees', async () => {
    const name = 'Name';
    const title = 'Title';
    const nameHash = hashMessage(name, { $format: 'ICU' });
    const titleHash = hashMessage(title, { $format: 'ICU' });
    const manager = createManager({
      dictionary: {
        user: {
          profile: {
            name,
            title,
          },
        },
      },
      runtimeTranslation: {},
    });
    const runtimeTranslate = getDictionaryRuntimeTranslate(manager);

    mockTranslateMany.mockResolvedValue({
      [nameHash]: {
        success: true,
        translation: 'Nom',
      },
      [titleHash]: {
        success: true,
        translation: 'Titre',
      },
    });

    await expect(
      runtimeTranslate.dictionaryRuntimeTranslateObj('fr', 'user.profile')
    ).resolves.toEqual({
      name: 'Nom',
      title: 'Titre',
    });
  });

  it('dictionaryRuntimeTranslateObj() rejects when source dictionary object is missing', async () => {
    const manager = createManager({
      dictionary: {
        greeting: 'Hello',
      },
    });
    const runtimeTranslate = getDictionaryRuntimeTranslate(manager);

    await expect(
      runtimeTranslate.dictionaryRuntimeTranslateObj('fr', 'missing')
    ).rejects.toThrow(
      'I18nManager: source dictionary entry missing is not defined'
    );
  });

  it('resolves custom aliases for locale metadata operations', () => {
    const manager = createManager({
      customMapping: {
        'brand-french': {
          code: 'fr',
          name: 'Brand French',
        },
      },
    });

    expect(manager.requiresTranslation('brand-french')).toBe(true);
    expect(manager.requiresDialectTranslation('en-US')).toBe(false);
    expect(() => manager.getGTClass('brand-french')).not.toThrow();
  });

  it('preserves alias target locale when creating a GT instance', () => {
    const manager = createManager({
      locales: ['en', 'brand-french'],
      customMapping: {
        'brand-french': {
          code: 'fr',
          name: 'Brand French',
        },
      },
    });

    const gt = manager.getGTClass('fr');

    expect(gt.targetLocale).toBe('brand-french');
    expect(gt.locales).toEqual(['en', 'fr']);
  });

  it('normalizes custom aliases before loading and reading locale caches', async () => {
    const loadTranslations = vi
      .fn()
      .mockResolvedValue({ [expectedHash]: translatedString });
    const manager = createManager({
      loadTranslations,
      customMapping: {
        'brand-french': {
          code: 'fr',
          name: 'Brand French',
        },
      },
    });

    await manager.loadTranslations('brand-french');

    expect(loadTranslations).toHaveBeenCalledTimes(1);
    expect(loadTranslations).toHaveBeenCalledWith('fr');
    expect(
      manager.lookupTranslation('brand-french', message, lookupOptions)
    ).toBe(translatedString);
    expect(loadTranslations).toHaveBeenCalledTimes(1);
  });

  it('does not need current locale state for explicit locale operations', async () => {
    const loadTranslations = vi
      .fn()
      .mockResolvedValue({ [expectedHash]: translatedString });
    const manager = createManager({
      loadTranslations,
    });

    await manager.loadTranslations('fr');

    expect(loadTranslations).toHaveBeenCalledWith('fr');
    expect(manager.lookupTranslation('fr', message, lookupOptions)).toBe(
      translatedString
    );
    await expect(
      manager.lookupTranslationWithFallback('fr', message, lookupOptions)
    ).resolves.toBe(translatedString);
    await expect(manager.getLookupTranslation('fr')).resolves.toEqual(
      expect.any(Function)
    );
    expect(manager.requiresTranslation('fr')).toBe(true);
    expect(manager.requiresDialectTranslation('fr')).toBe(false);
    expect(() => manager.getGTClass('fr')).not.toThrow();
  });

  it('emits dictionary cache lifecycle events', async () => {
    const manager = createManager({
      dictionary: {
        greeting: 'Hello',
      },
      loadDictionary: vi.fn().mockResolvedValue({
        greeting: 'Bonjour',
      }),
    });
    const localesDictionaryMiss = vi.fn();
    const localesDictionaryHit = vi.fn();
    const dictionaryCacheHit = vi.fn();
    const dictionaryCacheMiss = vi.fn();

    manager.subscribe('locales-dictionary-cache-miss', localesDictionaryMiss);
    manager.subscribe('locales-dictionary-cache-hit', localesDictionaryHit);
    manager.subscribe('dictionary-cache-hit', dictionaryCacheHit);
    manager.subscribe('dictionary-cache-miss', dictionaryCacheMiss);

    await manager.loadDictionary('fr');
    await manager.loadDictionary('fr');
    expect(manager.lookupDictionary('fr', 'greeting')).toEqual({
      entry: 'Bonjour',
      options: {},
    });

    expect(localesDictionaryMiss).toHaveBeenCalledWith({
      locale: 'fr',
      dictionary: {
        greeting: 'Bonjour',
      },
    });
    expect(localesDictionaryHit).toHaveBeenCalledWith({
      locale: 'fr',
      dictionary: {
        greeting: 'Bonjour',
      },
    });
    expect(dictionaryCacheHit).toHaveBeenCalledWith({
      locale: 'fr',
      id: 'greeting',
      dictionaryEntry: {
        entry: 'Bonjour',
        options: {},
      },
    });
    expect(dictionaryCacheMiss).not.toHaveBeenCalled();
  });
});
