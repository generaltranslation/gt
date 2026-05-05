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
    expect(manager.lookupDictionary(testCase.locale, 'greeting')).toBe(
      testCase.dictionary.greeting
    );
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

    expect(manager.lookupDictionary('fr', 'greeting')).toBe('Bonjour');
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

    expect(manager.lookupDictionary('fr', 'user.name')).toBe('Nom');
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
    expect(manager.lookupDictionary('en', 'greeting')).toBe('Hello');
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
    expect(manager.lookupDictionary('en', 'greeting')).toBe('Hello');
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
    expect(manager.lookupDictionary('en', 'user.name')).toBe('Name');
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
    expect(manager.lookupDictionary('fr', 'greeting')).toBe('Bonjour');

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
      dictionaryEntry: 'Bonjour',
    });
    expect(dictionaryCacheMiss).not.toHaveBeenCalled();
  });
});
