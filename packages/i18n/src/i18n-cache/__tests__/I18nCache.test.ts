import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { I18nCache } from '../I18nCache';
import { createTranslateManyFactory } from '../translations-manager/utils/createTranslateMany';
import { hashMessage } from '../../utils/hashMessage';
import { LookupOptions } from '../../translation-functions/types/options';
import { initializeI18nConfig } from '../../i18n-config/singleton-operations';
import type { CustomMapping } from '@generaltranslation/format/types';

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

function createCache(overrides: Record<string, unknown> = {}) {
  const {
    defaultLocale = 'en',
    locales = ['en', 'fr', 'es'],
    customMapping,
    ...cacheOverrides
  } = overrides;
  initializeI18nConfig({
    defaultLocale: defaultLocale as string,
    locales: locales as string[],
    customMapping: customMapping as CustomMapping | undefined,
  });

  return new I18nCache({
    loadTranslations: vi
      .fn()
      .mockResolvedValue({ [expectedHash]: translatedString }),
    ...cacheOverrides,
  });
}

describe('I18nCache', () => {
  beforeEach(() => {
    initializeI18nConfig({
      defaultLocale: 'en',
      locales: ['en', 'fr', 'es'],
    });
    vi.clearAllMocks();
    mockTranslateMany.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  // ===== REGRESSION TESTS ===== //

  it('resolveTranslationSync returns translation after loadTranslations', async () => {
    const cache = createCache();

    // Load translations first
    await cache.loadTranslations('fr');

    // Now sync resolution should work
    const result = cache.resolveTranslationSync('fr', message, lookupOptions);
    expect(result).toBe(translatedString);
  });

  it('getTranslations returns empty object for invalid locale', async () => {
    const cache = createCache();

    const result = await cache.getTranslations('zh');
    expect(result).toEqual({});
  });

  it('getTranslationResolver returns a working resolver function', async () => {
    const cache = createCache();

    const resolver = await cache.getTranslationResolver('fr');
    const result = resolver(message, lookupOptions);

    expect(result).toBe(translatedString);
  });

  it('enables dev hot reload with dev credentials, a project id, and development environment', () => {
    vi.stubEnv('NODE_ENV', 'development');

    const cache = createCache({
      devApiKey: 'dev-key',
      projectId: 'project-id',
    });

    expect(cache.isDevHotReloadEnabled()).toBe(true);
  });

  it.each([
    {
      name: 'missing dev API key',
      environment: 'development',
      config: {
        projectId: 'project-id',
      },
    },
    {
      name: 'missing project id',
      environment: 'development',
      config: {
        devApiKey: 'dev-key',
      },
    },
    {
      name: 'disabled runtime URL',
      environment: 'development',
      config: {
        devApiKey: 'dev-key',
        projectId: 'project-id',
        runtimeUrl: null,
      },
    },
    {
      name: 'production environment',
      environment: 'production',
      config: {
        devApiKey: 'dev-key',
        projectId: 'project-id',
      },
    },
  ])('disables dev hot reload for $name', ({ config, environment }) => {
    vi.stubEnv('NODE_ENV', environment);

    const cache = createCache(config);

    expect(cache.isDevHotReloadEnabled()).toBe(false);
  });

  // ===== NEW BEHAVIOR TESTS ===== //

  it('loadTranslations() returns Record<Hash, Translation>', async () => {
    const cache = createCache();

    const translations = await cache.loadTranslations('fr');

    expect(translations[expectedHash]).toBe(translatedString);
  });

  it('loadDictionary() returns source dictionary without loading when locale does not require translation', async () => {
    const loadDictionary = vi.fn().mockResolvedValue({ greeting: 'Bonjour' });
    const cache = createCache({
      dictionary: {
        greeting: 'Hello',
      },
      loadDictionary,
    });

    const dictionary = await cache.loadDictionary('en');

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
    const cache = createCache({
      dictionary: {
        greeting: 'Hello',
      },
      loadDictionary,
    });

    const dictionary = await cache.loadDictionary('fr');
    const cachedDictionary = await cache.loadDictionary('fr');

    expect(loadDictionary).toHaveBeenCalledTimes(1);
    expect(loadDictionary).toHaveBeenCalledWith('fr');
    expect(dictionary).toEqual({
      greeting: 'Bonjour',
      user: {
        name: 'Nom',
      },
    });
    expect(cachedDictionary).toEqual(dictionary);
    expect(cachedDictionary).not.toBe(dictionary);

    dictionary.greeting = 'Salut';
    await expect(cache.loadDictionary('fr')).resolves.toMatchObject({
      greeting: 'Bonjour',
    });
  });

  it('loadDictionary() returns deep copies of cached dictionaries', async () => {
    const cache = createCache({
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

    const dictionary = (await cache.loadDictionary('fr')) as {
      user: {
        profile: {
          name: string;
        };
      };
    };
    dictionary.user.profile.name = 'Changed';

    await expect(cache.loadDictionary('fr')).resolves.toEqual({
      user: {
        profile: {
          name: 'Nom',
        },
      },
    });
  });

  it('updateDictionaries() updates locale dictionary lookups', () => {
    const cache = createCache({
      dictionary: {
        greeting: 'Hello',
        cta: 'Click me',
        navigation: {
          about: 'About',
        },
      },
    });

    cache.updateDictionaries({
      en: {
        greeting: 'Hi',
        navigation: {
          home: 'Home',
        },
      },
      fr: {
        greeting: 'Bonjour',
        navigation: {
          home: 'Accueil',
        },
      },
    });

    expect(cache.lookupDictionary('en', 'greeting')).toEqual({
      entry: 'Hi',
      options: {},
    });
    expect(cache.lookupDictionaryObj('en', 'navigation')).toEqual({
      about: 'About',
      home: 'Home',
    });
    expect(cache.lookupDictionary('en', 'cta')).toEqual({
      entry: 'Click me',
      options: {},
    });
    expect(cache.lookupDictionary('fr', 'greeting')).toEqual({
      entry: 'Bonjour',
      options: {},
    });
    expect(cache.lookupDictionaryObj('fr', 'navigation')).toEqual({
      home: 'Accueil',
    });
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
    const cache = createCache({
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

    const dictionary = await cache.loadDictionary(testCase.locale);

    expect(loadDictionary).toHaveBeenCalledTimes(1);
    expect(loadDictionary).toHaveBeenCalledWith(testCase.dictionaryLocale);
    expect(dictionary).toEqual(testCase.dictionary);
    expect(cache.lookupDictionary(testCase.locale, 'greeting')).toEqual({
      entry: testCase.dictionary.greeting,
      options: {},
    });
  });

  it('lookupDictionary() returns a loaded target locale leaf', async () => {
    const cache = createCache({
      dictionary: {
        greeting: 'Hello',
      },
      loadDictionary: vi.fn().mockResolvedValue({
        greeting: 'Bonjour',
      }),
    });

    await cache.loadDictionary('fr');

    expect(cache.lookupDictionary('fr', 'greeting')).toEqual({
      entry: 'Bonjour',
      options: {},
    });
  });

  it('lookupDictionary() returns a loaded target locale nested leaf', async () => {
    const cache = createCache({
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

    await cache.loadDictionary('fr');

    expect(cache.lookupDictionary('fr', 'user.name')).toEqual({
      entry: 'Nom',
      options: {},
    });
  });

  it('lookupDictionary() returns the entry and options from a metadata tuple leaf', async () => {
    const cache = createCache({
      dictionary: {
        greeting: ['Hello', { $context: 'homepage', $maxChars: 10 }],
      },
      loadDictionary: vi.fn().mockResolvedValue({
        greeting: ['Bonjour', { context: 'homepage' }],
      }),
    });

    await cache.loadDictionary('fr');

    expect(cache.lookupDictionary('fr', 'greeting')).toEqual({
      entry: 'Bonjour',
      options: { context: 'homepage' },
    });
  });

  it('lookupDictionary() returns undefined when target locale is not loaded', () => {
    const cache = createCache({
      dictionary: {
        greeting: 'Hello',
      },
      loadDictionary: vi.fn().mockResolvedValue({
        greeting: 'Bonjour',
      }),
    });

    expect(cache.lookupDictionary('fr', 'greeting')).toBeUndefined();
    expect(cache.lookupDictionary('en', 'greeting')).toEqual({
      entry: 'Hello',
      options: {},
    });
  });

  it('lookupDictionary() returns undefined when source leaf is missing and translation is not required', () => {
    const cache = createCache({
      dictionary: {
        greeting: 'Hello',
      },
    });

    expect(cache.lookupDictionary('en', 'missing')).toBeUndefined();
  });

  it('lookupDictionary() returns undefined when source leaf is missing and translation is required', () => {
    const cache = createCache({
      dictionary: {
        greeting: 'Hello',
      },
    });

    expect(cache.lookupDictionary('fr', 'missing')).toBeUndefined();
  });

  it('lookupDictionary() returns undefined when target leaf is missing', async () => {
    const cache = createCache({
      dictionary: {
        greeting: 'Hello',
      },
      loadDictionary: vi.fn().mockResolvedValue({}),
    });

    await cache.loadDictionary('fr');

    expect(cache.lookupDictionary('fr', 'greeting')).toBeUndefined();
    expect(cache.lookupDictionary('en', 'greeting')).toEqual({
      entry: 'Hello',
      options: {},
    });
  });

  it('lookupDictionary() returns undefined when target nested leaf is missing', async () => {
    const cache = createCache({
      dictionary: {
        user: {
          name: 'Name',
        },
      },
      loadDictionary: vi.fn().mockResolvedValue({
        user: {},
      }),
    });

    await cache.loadDictionary('fr');

    expect(cache.lookupDictionary('fr', 'user.name')).toBeUndefined();
    expect(cache.lookupDictionary('en', 'user.name')).toEqual({
      entry: 'Name',
      options: {},
    });
  });

  it('lookupDictionary() does not return dictionary subtrees', async () => {
    const cache = createCache({
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

    await cache.loadDictionary('fr');

    expect(cache.lookupDictionary('fr', 'user')).toBeUndefined();
  });

  it('lookupDictionaryObj() returns source leaves and subtrees', () => {
    const cache = createCache({
      dictionary: {
        greeting: 'Hello',
        user: {
          profile: {
            name: 'Name',
          },
        },
      },
    });

    expect(cache.lookupDictionaryObj('en', 'greeting')).toBe('Hello');
    expect(cache.lookupDictionaryObj('en', 'user.profile')).toEqual({
      name: 'Name',
    });
  });

  it('lookupDictionaryObj() returns loaded target leaves and subtrees', async () => {
    const cache = createCache({
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

    await cache.loadDictionary('fr');

    expect(cache.lookupDictionaryObj('fr', 'greeting')).toBe('Bonjour');
    expect(cache.lookupDictionaryObj('fr', 'user.profile')).toEqual({
      name: 'Nom',
    });
  });

  it('lookupDictionaryObj() returns copies of dictionary subtrees', () => {
    const cache = createCache({
      dictionary: {
        user: {
          profile: {
            name: 'Name',
          },
        },
      },
    });

    const profile = cache.lookupDictionaryObj('en', 'user.profile');
    expect(profile).toEqual({
      name: 'Name',
    });
    (profile as { name: string }).name = 'Changed';

    expect(cache.lookupDictionaryObj('en', 'user.profile')).toEqual({
      name: 'Name',
    });
  });

  it('lookupDictionaryObj() returns undefined when target locale is not loaded', () => {
    const cache = createCache({
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

    expect(cache.lookupDictionaryObj('fr', 'user.profile')).toBeUndefined();
  });

  it('lookupDictionaryObj() returns undefined for missing paths', async () => {
    const cache = createCache({
      dictionary: {
        greeting: 'Hello',
      },
      loadDictionary: vi.fn().mockResolvedValue({
        greeting: 'Bonjour',
      }),
    });

    await cache.loadDictionary('fr');

    expect(cache.lookupDictionaryObj('fr', 'missing')).toBeUndefined();
    expect(cache.lookupDictionaryObj('en', 'missing')).toBeUndefined();
  });

  it('lookupDictionaryWithFallback() returns the source dictionary entry when translation is not required', async () => {
    const loadDictionary = vi.fn().mockResolvedValue({
      greeting: 'Bonjour',
    });
    const cache = createCache({
      dictionary: {
        greeting: 'Hello',
      },
      loadDictionary,
    });

    await expect(
      cache.lookupDictionaryWithFallback('en', 'greeting')
    ).resolves.toEqual({
      entry: 'Hello',
      options: {},
    });
    expect(loadDictionary).not.toHaveBeenCalled();
  });

  it('lookupDictionaryWithFallback() throws when source entry is missing and translation is not required', async () => {
    const cache = createCache({
      dictionary: {
        greeting: 'Hello',
      },
      loadDictionary: vi.fn().mockResolvedValue({
        greeting: 'Bonjour',
      }),
    });

    await expect(
      cache.lookupDictionaryWithFallback('en', 'missing')
    ).rejects.toThrow(
      'I18nCache: source dictionary entry missing is not defined'
    );
  });

  it('lookupDictionaryWithFallback() loads and returns a target dictionary entry', async () => {
    const loadDictionary = vi.fn().mockResolvedValue({
      greeting: 'Bonjour',
    });
    const cache = createCache({
      dictionary: {
        greeting: 'Hello',
      },
      loadDictionary,
    });

    await expect(
      cache.lookupDictionaryWithFallback('fr', 'greeting')
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
      const cache = createCache({
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
        cache.lookupDictionaryWithFallback(testCase.locale, 'greeting')
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
    const cache = createCache({
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
      cache.lookupDictionaryWithFallback('fr', 'greeting')
    ).resolves.toEqual({
      entry: 'Bonjour',
      options: {},
    });
    expect(cache.lookupDictionary('fr', 'greeting')).toEqual({
      entry: 'Bonjour',
      options: {},
    });
  });

  it('lookupDictionaryWithFallback() throws when source dictionary entry is missing', async () => {
    const cache = createCache({
      dictionary: {
        greeting: 'Hello',
      },
      loadDictionary: vi.fn().mockResolvedValue({}),
      runtimeTranslation: {},
    });

    await expect(
      cache.lookupDictionaryWithFallback('fr', 'missing')
    ).rejects.toThrow(
      'I18nCache: source dictionary entry missing is not defined'
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
    const cache = createCache({
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
      cache.lookupDictionaryObjWithFallback('en', 'greeting')
    ).resolves.toBe('Hello');
    await expect(
      cache.lookupDictionaryObjWithFallback('en', 'user.profile')
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
    const cache = createCache({
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
      cache.lookupDictionaryObjWithFallback('fr', 'user.profile')
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
    const cache = createCache({
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
      cache.lookupDictionaryObjWithFallback('fr', 'user.profile')
    ).resolves.toEqual({
      name: 'Nom',
      title: 'Titre',
    });
    expect(cache.lookupDictionaryObj('fr', 'user.profile')).toEqual({
      name: 'Nom',
      title: 'Titre',
    });
  });

  it('lookupDictionaryObjWithFallback() fills missing leaves in partial target subtrees', async () => {
    const name = 'Name';
    const title = 'Title';
    const titleHash = hashMessage(title, { $format: 'ICU' });
    const cache = createCache({
      dictionary: {
        user: {
          profile: {
            name,
            title,
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
      runtimeTranslation: {},
    });

    mockTranslateMany.mockResolvedValue({
      [titleHash]: {
        success: true,
        translation: 'Titre',
      },
    });

    await expect(
      cache.lookupDictionaryObjWithFallback('fr', 'user.profile')
    ).resolves.toEqual({
      name: 'Nom',
      title: 'Titre',
    });
    expect(cache.lookupDictionaryObj('fr', 'user.profile')).toEqual({
      name: 'Nom',
      title: 'Titre',
    });
  });

  it('lookupDictionaryObjWithFallback() returns loaded target subtrees when source is missing', async () => {
    const cache = createCache({
      dictionary: {
        greeting: 'Hello',
      },
      loadDictionary: vi.fn().mockResolvedValue({
        extra: {
          label: 'Supplement',
        },
      }),
      runtimeTranslation: {},
    });

    await expect(
      cache.lookupDictionaryObjWithFallback('fr', 'extra')
    ).resolves.toEqual({
      label: 'Supplement',
    });
    expect(mockTranslateMany).not.toHaveBeenCalled();
  });

  it('lookupDictionaryObjWithFallback() throws when source dictionary object is missing', async () => {
    const cache = createCache({
      dictionary: {
        greeting: 'Hello',
      },
      loadDictionary: vi.fn().mockResolvedValue({}),
      runtimeTranslation: {},
    });

    await expect(
      cache.lookupDictionaryObjWithFallback('fr', 'missing')
    ).rejects.toThrow(
      'I18nCache: source dictionary entry missing is not defined'
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
      const cache = createCache({
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
        cache.lookupDictionaryObjWithFallback(testCase.locale, 'user.profile')
      ).resolves.toEqual(testCase.dictionary.user.profile);
      expect(loadDictionary).toHaveBeenCalledTimes(1);
      expect(loadDictionary).toHaveBeenCalledWith(testCase.dictionaryLocale);
    }
  );

  it('lookupTranslation() returns undefined before load, translation after', async () => {
    const cache = createCache();

    // Before loading
    const before = cache.lookupTranslation('fr', message, lookupOptions);
    expect(before).toBeUndefined();

    // Load translations
    await cache.loadTranslations('fr');

    // After loading
    const after = cache.lookupTranslation('fr', message, lookupOptions);
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
    const cache = createCache({
      cacheExpiryTime: testCase.cacheExpiryTime,
      loadTranslations,
    });

    await cache.loadTranslations('fr');
    expect(cache.lookupTranslation('fr', message, lookupOptions)).toBe(
      translatedString
    );

    vi.advanceTimersByTime(testCase.advanceBy);
    expect(cache.lookupTranslation('fr', message, lookupOptions)).toBe(
      testCase.lookupAfter
    );

    const translations = await cache.loadTranslations('fr');
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
      const cache = createCache({
        defaultLocale: 'en-US',
        locales: ['en-US', 'en'],
        loadTranslations,
        ...(testCase.customMapping && {
          customMapping: testCase.customMapping,
        }),
      });

      const translations = await cache.loadTranslations(testCase.locale);

      expect(loadTranslations).toHaveBeenCalledTimes(1);
      expect(loadTranslations).toHaveBeenCalledWith(testCase.translationLocale);
      expect(translations[expectedHash]).toBe(testCase.translation);
      expect(
        cache.lookupTranslation(testCase.locale, message, lookupOptions)
      ).toBe(testCase.translation);
    }
  );

  it('lookupTranslationWithFallback() falls back to runtime translate on cache miss', async () => {
    const unknownMessage = 'Unknown message';
    const unknownOptions: LookupOptions = { $format: 'ICU' };
    const unknownHash = hashMessage(unknownMessage, unknownOptions);

    // loadTranslations returns translations that do NOT include unknownMessage
    const cache = createCache({
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

    const result = await cache.lookupTranslationWithFallback(
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

  it('lookupDictionaryWithFallback() respects source dictionary format options', async () => {
    const source = 'Hello {name}';
    const sourceOptions: LookupOptions = {
      $format: 'I18NEXT',
      $context: 'homepage',
    };
    const sourceHash = hashMessage(source, sourceOptions);
    const cache = createCache({
      dictionary: {
        greeting: [source, { $format: 'I18NEXT', context: 'homepage' }],
      },
      runtimeTranslation: {},
    });

    mockTranslateMany.mockResolvedValue({
      [sourceHash]: {
        success: true,
        translation: 'Bonjour {name}',
      },
    });

    await expect(
      cache.lookupDictionaryWithFallback('fr', 'greeting')
    ).resolves.toEqual({
      entry: 'Bonjour {name}',
      options: {},
    });
  });

  it('lookupDictionaryWithFallback() defaults missing source dictionary format to ICU', async () => {
    const source = 'Hello {name}';
    const sourceOptions: LookupOptions = {
      $format: 'ICU',
      $context: 'homepage',
    };
    const sourceHash = hashMessage(source, sourceOptions);
    const cache = createCache({
      dictionary: {
        greeting: [source, { context: 'homepage' }],
      },
      runtimeTranslation: {},
    });

    mockTranslateMany.mockResolvedValue({
      [sourceHash]: {
        success: true,
        translation: 'Bonjour {name}',
      },
    });

    await expect(
      cache.lookupDictionaryWithFallback('fr', 'greeting')
    ).resolves.toEqual({
      entry: 'Bonjour {name}',
      options: {},
    });
  });

  it('lookupDictionaryWithFallback() rejects when runtime translation is not a string', async () => {
    vi.stubEnv('NODE_ENV', 'development');

    const source = 'Hello';
    const sourceOptions: LookupOptions = { $format: 'ICU' };
    const sourceHash = hashMessage(source, sourceOptions);
    const cache = createCache({
      dictionary: {
        greeting: source,
      },
      runtimeTranslation: {},
    });

    mockTranslateMany.mockResolvedValue({
      [sourceHash]: {
        success: true,
        translation: ['Bonjour'],
      },
    });

    await expect(
      cache.lookupDictionaryWithFallback('fr', 'greeting')
    ).rejects.toThrow(
      'Dictionary entry "greeting" could not be translated into a string. Check the source entry and translation loader output.'
    );
  });

  it('resolves custom aliases for GT instances', () => {
    const cache = createCache({
      customMapping: {
        'brand-french': {
          code: 'fr',
          name: 'Brand French',
        },
      },
    });

    expect(() => cache.getGTClass('brand-french')).not.toThrow();
  });

  it('preserves alias target locale when creating a GT instance', () => {
    const cache = createCache({
      locales: ['en', 'brand-french'],
      customMapping: {
        'brand-french': {
          code: 'fr',
          name: 'Brand French',
        },
      },
    });

    const gt = cache.getGTClass('fr');

    expect(gt.targetLocale).toBe('brand-french');
    expect(gt.locales).toEqual(['en', 'fr']);
  });

  it('normalizes custom aliases before loading and reading locale caches', async () => {
    const loadTranslations = vi
      .fn()
      .mockResolvedValue({ [expectedHash]: translatedString });
    const cache = createCache({
      loadTranslations,
      customMapping: {
        'brand-french': {
          code: 'fr',
          name: 'Brand French',
        },
      },
    });

    await cache.loadTranslations('brand-french');

    expect(loadTranslations).toHaveBeenCalledTimes(1);
    expect(loadTranslations).toHaveBeenCalledWith('fr');
    expect(
      cache.lookupTranslation('brand-french', message, lookupOptions)
    ).toBe(translatedString);
    expect(loadTranslations).toHaveBeenCalledTimes(1);
  });

  it('does not need current locale state for explicit locale operations', async () => {
    const loadTranslations = vi
      .fn()
      .mockResolvedValue({ [expectedHash]: translatedString });
    const cache = createCache({
      loadTranslations,
    });

    await cache.loadTranslations('fr');

    expect(loadTranslations).toHaveBeenCalledWith('fr');
    expect(cache.lookupTranslation('fr', message, lookupOptions)).toBe(
      translatedString
    );
    await expect(
      cache.lookupTranslationWithFallback('fr', message, lookupOptions)
    ).resolves.toBe(translatedString);
    await expect(cache.getLookupTranslation('fr')).resolves.toEqual(
      expect.any(Function)
    );
    expect(() => cache.getGTClass('fr')).not.toThrow();
  });

  it('does not clone loaded dictionaries for cache hit events without subscribers', async () => {
    const cache = createCache({
      dictionary: {
        greeting: 'Hello',
      },
      loadDictionary: vi.fn().mockResolvedValue({
        greeting: 'Bonjour',
        nested: {
          title: 'Titre',
        },
      }),
    });

    await cache.loadDictionary('fr');
    const structuredCloneSpy = vi.spyOn(globalThis, 'structuredClone');
    try {
      expect(cache.lookupDictionaryObj('fr', 'greeting')).toBe('Bonjour');
      expect(structuredCloneSpy).not.toHaveBeenCalled();
    } finally {
      structuredCloneSpy.mockRestore();
    }
  });

  it('emits dictionary cache lifecycle events', async () => {
    const cache = createCache({
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

    cache.subscribe('locales-dictionary-cache-miss', localesDictionaryMiss);
    cache.subscribe('locales-dictionary-cache-hit', localesDictionaryHit);
    cache.subscribe('dictionary-cache-hit', dictionaryCacheHit);
    cache.subscribe('dictionary-cache-miss', dictionaryCacheMiss);

    await cache.loadDictionary('fr');
    await cache.loadDictionary('fr');
    expect(cache.lookupDictionary('fr', 'greeting')).toEqual({
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
