import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { I18nCache } from '../../i18n-cache/I18nCache';
import { hashContent } from '../../utils/hashContent';
import { LookupOptions } from '../../translation-functions/types/options';
import { initializeI18nConfig } from '../../i18n-config/singleton-operations';
import type { I18nConfigParams } from '../../i18n-config/I18nConfig';
import type { I18nCacheConstructorParams } from '../../i18n-cache/types';
import type { DictionaryManagerParams } from '../DictionaryManager';
import { createDictionaryHarness } from './dictionaryHarness';

// Mock createTranslateManyFactory to inject a controlled translateMany
const mockTranslateMany = vi.fn();
vi.mock(
  '../../i18n-cache/translations-manager/utils/createTranslateMany',
  () => ({
    createTranslateManyFactory: vi
      .fn()
      .mockReturnValue(() => mockTranslateMany),
  })
);

// Test data
const message = 'Hello {name}!';
const lookupOptions: LookupOptions = {
  $format: 'ICU',
  $context: 'greeting',
};
const expectedHash = hashContent(message, lookupOptions);
const translatedString = 'Bonjour {name} !';

type TestGlobal = typeof globalThis & {
  __generaltranslation?: unknown;
};

function resetGTGlobals() {
  Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
}

function createCache({
  defaultLocale = 'en',
  locales = ['en', 'fr', 'es'],
  customMapping,
  dictionary,
  loadDictionary,
  ...cacheOverrides
}: Pick<I18nConfigParams, 'defaultLocale' | 'locales' | 'customMapping'> &
  I18nCacheConstructorParams &
  DictionaryManagerParams = {}) {
  resetGTGlobals();
  initializeI18nConfig({ defaultLocale, locales, customMapping });

  const cache = new I18nCache({
    loadTranslations: vi
      .fn()
      .mockResolvedValue({ [expectedHash]: translatedString }),
    ...cacheOverrides,
  });
  return createDictionaryHarness(cache, {
    dictionary,
    loadDictionary,
    cacheExpiryTime: cacheOverrides.cacheExpiryTime,
  });
}

describe('DictionaryManager', () => {
  beforeEach(() => {
    resetGTGlobals();
    initializeI18nConfig({
      defaultLocale: 'en',
      locales: ['en', 'fr', 'es'],
    });
    vi.clearAllMocks();
    mockTranslateMany.mockReset();
  });

  afterEach(() => {
    resetGTGlobals();
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('loadDictionary() returns source dictionary without loading when locale does not require translation', async () => {
    const loadDictionary = vi.fn().mockResolvedValue({ greeting: 'Bonjour' });
    const { manager } = createCache({
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

  it('loadDictionary() loads and caches dictionary for requested locale', async () => {
    const loadDictionary = vi.fn().mockResolvedValue({
      greeting: 'Bonjour',
      user: {
        name: 'Nom',
      },
    });
    const { manager } = createCache({
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
    expect(cachedDictionary).toEqual(dictionary);
    expect(cachedDictionary).not.toBe(dictionary);

    dictionary.greeting = 'Salut';
    await expect(manager.loadDictionary('fr')).resolves.toMatchObject({
      greeting: 'Bonjour',
    });
  });

  it('loadDictionary() returns deep copies of cached dictionaries', async () => {
    const { manager } = createCache({
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

    const dictionary = (await manager.loadDictionary('fr')) as {
      user: {
        profile: {
          name: string;
        };
      };
    };
    dictionary.user.profile.name = 'Changed';

    await expect(manager.loadDictionary('fr')).resolves.toEqual({
      user: {
        profile: {
          name: 'Nom',
        },
      },
    });
  });

  it('updateDictionaries() updates locale dictionary lookups', () => {
    const { manager } = createCache({
      dictionary: {
        greeting: 'Hello',
        cta: 'Click me',
        navigation: {
          about: 'About',
        },
      },
    });

    manager.updateDictionaries({
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

    expect(manager.lookupDictionary('en', 'greeting')).toEqual({
      entry: 'Hi',
      options: {},
    });
    expect(manager.lookupDictionaryObj('en', 'navigation')).toEqual({
      about: 'About',
      home: 'Home',
    });
    expect(manager.lookupDictionary('en', 'cta')).toEqual({
      entry: 'Click me',
      options: {},
    });
    expect(manager.lookupDictionary('fr', 'greeting')).toEqual({
      entry: 'Bonjour',
      options: {},
    });
    expect(manager.lookupDictionaryObj('fr', 'navigation')).toEqual({
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
  ])('loadDictionary() uses cache locale for $name', async (testCase) => {
    const loadDictionary = vi.fn().mockResolvedValue(testCase.dictionary);
    const { manager } = createCache({
      defaultLocale: 'en-US',
      locales: ['en-US', 'en'],
      dictionary: {
        greeting: 'Hello',
      },
      loadDictionary,
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
    const { manager } = createCache({
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
    const { manager } = createCache({
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
    const { manager } = createCache({
      dictionary: {
        greeting: ['Hello', { $context: 'homepage', $maxChars: 10 }],
      },
      loadDictionary: vi.fn().mockResolvedValue({
        greeting: ['Bonjour', { $context: 'homepage' }],
      }),
    });

    await manager.loadDictionary('fr');

    expect(manager.lookupDictionary('fr', 'greeting')).toEqual({
      entry: 'Bonjour',
      options: { $context: 'homepage' },
    });
  });

  it('lookupDictionary() returns undefined when target locale is not loaded', () => {
    const { manager } = createCache({
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
    const { manager } = createCache({
      dictionary: {
        greeting: 'Hello',
      },
    });

    expect(manager.lookupDictionary('en', 'missing')).toBeUndefined();
  });

  it('lookupDictionary() returns undefined when source leaf is missing and translation is required', () => {
    const { manager } = createCache({
      dictionary: {
        greeting: 'Hello',
      },
    });

    expect(manager.lookupDictionary('fr', 'missing')).toBeUndefined();
  });

  it('lookupDictionary() returns undefined when target leaf is missing', async () => {
    const { manager } = createCache({
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
    const { manager } = createCache({
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
    const { manager } = createCache({
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
    const { manager } = createCache({
      dictionary: {
        greeting: 'Hello',
        user: {
          profile: {
            name: 'Name',
          },
        },
      },
    });

    expect(manager.lookupDictionaryObj('en', 'greeting')).toBe('Hello');
    expect(manager.lookupDictionaryObj('en', 'user.profile')).toEqual({
      name: 'Name',
    });
  });

  it('lookupDictionaryObj() returns loaded target leaves and subtrees', async () => {
    const { manager } = createCache({
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

    expect(manager.lookupDictionaryObj('fr', 'greeting')).toBe('Bonjour');
    expect(manager.lookupDictionaryObj('fr', 'user.profile')).toEqual({
      name: 'Nom',
    });
  });

  it('lookupDictionaryObj() returns copies of dictionary subtrees', () => {
    const { manager } = createCache({
      dictionary: {
        user: {
          profile: {
            name: 'Name',
          },
        },
      },
    });

    const profile = manager.lookupDictionaryObj('en', 'user.profile');
    expect(profile).toEqual({
      name: 'Name',
    });
    (profile as { name: string }).name = 'Changed';

    expect(manager.lookupDictionaryObj('en', 'user.profile')).toEqual({
      name: 'Name',
    });
  });

  it('lookupDictionaryObj() returns undefined when target locale is not loaded', () => {
    const { manager } = createCache({
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
    const { manager } = createCache({
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

  it('lookupDictionaryWithFallback() returns the source dictionary entry when translation is not required', async () => {
    const loadDictionary = vi.fn().mockResolvedValue({
      greeting: 'Bonjour',
    });
    const { manager } = createCache({
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
    const { manager } = createCache({
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
      'I18nCache: source dictionary entry missing is not defined'
    );
  });

  it('lookupDictionaryWithFallback() loads and returns a target dictionary entry', async () => {
    const loadDictionary = vi.fn().mockResolvedValue({
      greeting: 'Bonjour',
    });
    const { manager } = createCache({
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
  ])(
    'lookupDictionaryWithFallback() uses cache locale for $name',
    async (testCase) => {
      const loadDictionary = vi.fn().mockResolvedValue(testCase.dictionary);
      const { manager } = createCache({
        defaultLocale: 'en-US',
        locales: ['en-US', 'en'],
        dictionary: {
          greeting: 'Hello',
        },
        loadDictionary,
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
    const sourceHash = hashContent(source, sourceOptions);
    const { manager } = createCache({
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
    const { manager } = createCache({
      dictionary: {
        greeting: 'Hello',
      },
      loadDictionary: vi.fn().mockResolvedValue({}),
      runtimeTranslation: {},
    });

    await expect(
      manager.lookupDictionaryWithFallback('fr', 'missing')
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
    const { manager } = createCache({
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
    ).resolves.toBe('Hello');
    await expect(
      manager.lookupDictionaryObjWithFallback('en', 'user.profile')
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
    const { manager } = createCache({
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
    const nameHash = hashContent(name, { $format: 'ICU' });
    const titleHash = hashContent(title, { $format: 'ICU' });
    const { manager } = createCache({
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

  it('lookupDictionaryObjWithFallback() fills missing leaves in partial target subtrees', async () => {
    const name = 'Name';
    const title = 'Title';
    const titleHash = hashContent(title, { $format: 'ICU' });
    const { manager } = createCache({
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

  it('lookupDictionaryObjWithFallback() returns loaded target subtrees when source is missing', async () => {
    const { manager } = createCache({
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
      manager.lookupDictionaryObjWithFallback('fr', 'extra')
    ).resolves.toEqual({
      label: 'Supplement',
    });
    expect(mockTranslateMany).not.toHaveBeenCalled();
  });

  it('lookupDictionaryObjWithFallback() throws when source dictionary object is missing', async () => {
    const { manager } = createCache({
      dictionary: {
        greeting: 'Hello',
      },
      loadDictionary: vi.fn().mockResolvedValue({}),
      runtimeTranslation: {},
    });

    await expect(
      manager.lookupDictionaryObjWithFallback('fr', 'missing')
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
  ])(
    'lookupDictionaryObjWithFallback() uses cache locale for $name',
    async (testCase) => {
      const loadDictionary = vi.fn().mockResolvedValue(testCase.dictionary);
      const { manager } = createCache({
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
      });

      await expect(
        manager.lookupDictionaryObjWithFallback(testCase.locale, 'user.profile')
      ).resolves.toEqual(testCase.dictionary.user.profile);
      expect(loadDictionary).toHaveBeenCalledTimes(1);
      expect(loadDictionary).toHaveBeenCalledWith(testCase.dictionaryLocale);
    }
  );

  it('lookupDictionaryWithFallback() respects source dictionary format options', async () => {
    const source = 'Hello {name}';
    const sourceOptions: LookupOptions = {
      $format: 'I18NEXT',
      $context: 'homepage',
    };
    const sourceHash = hashContent(source, sourceOptions);
    const { manager } = createCache({
      dictionary: {
        greeting: [source, { $format: 'I18NEXT', $context: 'homepage' }],
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
      manager.lookupDictionaryWithFallback('fr', 'greeting')
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
    const sourceHash = hashContent(source, sourceOptions);
    const { manager } = createCache({
      dictionary: {
        greeting: [source, { $context: 'homepage' }],
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
      manager.lookupDictionaryWithFallback('fr', 'greeting')
    ).resolves.toEqual({
      entry: 'Bonjour {name}',
      options: {},
    });
  });

  it('lookupDictionaryWithFallback() rejects when runtime translation is not a string', async () => {
    vi.stubEnv('NODE_ENV', 'development');

    const source = 'Hello';
    const sourceOptions: LookupOptions = { $format: 'ICU' };
    const sourceHash = hashContent(source, sourceOptions);
    const { manager } = createCache({
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
      manager.lookupDictionaryWithFallback('fr', 'greeting')
    ).rejects.toThrow(
      'Dictionary entry "greeting" could not be translated into a string. Check the source entry and translation loader output.'
    );
  });

  it('async lookup resolvers retain the loaded snapshot when cacheExpiryTime is 0', async () => {
    const loadDictionary = vi.fn().mockResolvedValue({
      greeting: 'Bonjour',
      user: {
        profile: {
          name: 'Nom',
        },
      },
    });
    const { cache, manager } = createCache({
      cacheExpiryTime: 0,
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

    const lookupTranslation = await cache.getLookupTranslation('fr');
    const { lookupDictionary, lookupDictionaryObj } =
      await manager.getLookupDictionary('fr');

    expect(
      cache.lookupTranslation('fr', message, lookupOptions)
    ).toBeUndefined();
    expect(manager.lookupDictionary('fr', 'greeting')).toBeUndefined();
    expect(manager.lookupDictionaryObj('fr', 'user.profile')).toBeUndefined();
    expect(lookupTranslation(message, lookupOptions)).toBe(translatedString);
    expect(lookupDictionary('greeting')).toEqual({
      entry: 'Bonjour',
      options: {},
    });
    expect(lookupDictionaryObj('user.profile')).toEqual({
      name: 'Nom',
    });
  });

  it('does not clone leaf dictionary values on lookup', async () => {
    const { manager } = createCache({
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

    await manager.loadDictionary('fr');
    const structuredCloneSpy = vi.spyOn(globalThis, 'structuredClone');
    try {
      expect(manager.lookupDictionaryObj('fr', 'greeting')).toBe('Bonjour');
      expect(structuredCloneSpy).not.toHaveBeenCalled();
    } finally {
      structuredCloneSpy.mockRestore();
    }
  });
});
