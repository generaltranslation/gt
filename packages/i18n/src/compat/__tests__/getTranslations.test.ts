import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nCache } from '../../i18n-cache/I18nCache';
import type { I18nCacheConstructorParams } from '../../i18n-cache/types';
import { setI18nCache } from '../../i18n-cache/singleton-operations';
import { setWritableConditionStore } from '../../condition-store/singleton-operations';
import { initializeI18nConfig } from '../../i18n-config/singleton-operations';
import type { I18nConfigParams } from '../../i18n-config/I18nConfig';
import { hashMessage } from '../../utils/hashMessage';
import { getTranslations } from '../getTranslations';
import { initializeDictionaryManager } from '../singleton-operations';
import type { DictionaryManagerParams } from '../DictionaryManager';

type TestGlobal = typeof globalThis & {
  __generaltranslation?: unknown;
};

function resetGTGlobals() {
  Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
}

describe('getTranslations', () => {
  beforeEach(resetGTGlobals);

  afterEach(() => {
    resetGTGlobals();
    vi.unstubAllEnvs();
  });

  function createConditionStore(locale: string) {
    return {
      getLocale: () => locale,
      getEnableI18n: () => true,
      setLocale: () => {},
      setEnableI18n: () => {},
    };
  }

  function createCache(
    i18nConfig: I18nConfigParams,
    {
      dictionary,
      loadDictionary,
      ...cacheConfig
    }: I18nCacheConstructorParams & DictionaryManagerParams = {}
  ) {
    initializeI18nConfig(i18nConfig);
    initializeDictionaryManager({
      dictionary,
      loadDictionary,
      cacheExpiryTime: cacheConfig.cacheExpiryTime,
    });
    return new I18nCache(cacheConfig);
  }

  it('getTranslations uses the current locale for dictionary entries', async () => {
    const cache = createCache(
      { defaultLocale: 'en', locales: ['en', 'fr'] },
      {
        dictionary: {
          greeting: 'Hello {name}!',
        },
        loadDictionary: vi.fn().mockResolvedValue({
          greeting: 'Bonjour {name} !',
        }),
      }
    );
    setI18nCache(cache);
    setWritableConditionStore(createConditionStore('fr'));

    const t = await getTranslations();

    expect(t('greeting', { name: 'Alice' })).toBe('Bonjour Alice !');
  });

  it('getTranslations scopes dictionary entries by root id', async () => {
    const cache = createCache(
      { defaultLocale: 'en', locales: ['en', 'fr'] },
      {
        dictionary: {
          metadata: {
            greeting: 'Hello {name}!',
          },
        },
        loadDictionary: vi.fn().mockResolvedValue({
          metadata: {
            greeting: 'Bonjour {name} !',
          },
        }),
      }
    );
    setI18nCache(cache);
    setWritableConditionStore(createConditionStore('fr'));

    const t = await getTranslations('metadata');

    expect(t('greeting', { name: 'Alice' })).toBe('Bonjour Alice !');
  });

  it('getTranslations returns source dictionary entries when no target translation exists', async () => {
    const cache = createCache(
      { defaultLocale: 'en', locales: ['en', 'fr'] },
      {
        dictionary: {
          greeting: 'Hello {name}!',
        },
        loadDictionary: vi.fn().mockResolvedValue({}),
      }
    );
    setI18nCache(cache);
    setWritableConditionStore(createConditionStore('fr'));

    const t = await getTranslations();

    expect(t('greeting', { name: 'Alice' })).toBe('Hello Alice!');
  });

  it('getTranslations falls back to translations with source dictionary options', async () => {
    const message = 'Hello {name}!';
    const lookupOptions = { $format: 'ICU', $context: 'homepage' } as const;
    const loadTranslations = vi.fn().mockResolvedValue({
      [hashMessage(message, lookupOptions)]: 'Bonjour {name} !',
    });
    const cache = createCache(
      { defaultLocale: 'en', locales: ['en', 'fr'] },
      {
        dictionary: {
          greeting: [message, { $context: 'homepage' }],
        },
        loadDictionary: vi.fn().mockResolvedValue({}),
        loadTranslations,
      }
    );
    setI18nCache(cache);
    setWritableConditionStore(createConditionStore('fr'));

    const t = await getTranslations();

    expect(t('greeting', { name: 'Alice' })).toBe('Bonjour Alice !');
    expect(loadTranslations).toHaveBeenCalledWith('fr');
  });

  it('getTranslations uses async lookup snapshots when cacheExpiryTime is 0', async () => {
    const message = 'Hello {name}!';
    const lookupOptions = { $format: 'ICU', $context: 'homepage' } as const;
    const loadTranslations = vi.fn().mockResolvedValue({
      [hashMessage(message, lookupOptions)]: 'Bonjour {name} !',
    });
    const cache = createCache(
      { defaultLocale: 'en', locales: ['en', 'fr'] },
      {
        cacheExpiryTime: 0,
        dictionary: {
          greeting: [message, { $context: 'homepage' }],
        },
        loadDictionary: vi.fn().mockResolvedValue({}),
        loadTranslations,
      }
    );
    setI18nCache(cache);
    setWritableConditionStore(createConditionStore('fr'));

    const t = await getTranslations();

    expect(
      cache.lookupTranslation('fr', message, lookupOptions)
    ).toBeUndefined();
    expect(t('greeting', { name: 'Alice' })).toBe('Bonjour Alice !');
  });

  it('getTranslations throws when the source dictionary entry is missing', async () => {
    const cache = createCache(
      { defaultLocale: 'en', locales: ['en', 'fr'] },
      {
        dictionary: {
          greeting: 'Hello',
        },
        loadDictionary: vi.fn().mockResolvedValue({}),
      }
    );
    setI18nCache(cache);
    setWritableConditionStore(createConditionStore('fr'));

    const t = await getTranslations();

    expect(() => t('missing')).toThrow(
      'Dictionary entry missing cannot be found'
    );
  });

  it('getTranslations obj throws when the source dictionary object is missing', async () => {
    const cache = createCache(
      { defaultLocale: 'en', locales: ['en', 'fr'] },
      {
        dictionary: {
          user: {
            profile: {
              name: 'Name',
            },
          },
        },
        loadDictionary: vi.fn().mockResolvedValue({}),
      }
    );
    setI18nCache(cache);
    setWritableConditionStore(createConditionStore('fr'));

    const t = await getTranslations();

    expect(() => t.obj('missing')).toThrow(
      'Dictionary entry missing cannot be found'
    );
  });

  it('getTranslations obj returns translated dictionary subtrees', async () => {
    const cache = createCache(
      { defaultLocale: 'en', locales: ['en', 'fr'] },
      {
        dictionary: {
          user: {
            profile: {
              name: 'Name',
              greeting: 'Hello {name}!',
              title: ['Title', { $context: 'profile title' }],
            },
          },
        },
        loadDictionary: vi.fn().mockResolvedValue({
          user: {
            profile: {
              name: 'Nom',
              greeting: 'Bonjour {name} !',
            },
          },
        }),
      }
    );
    setI18nCache(cache);
    setWritableConditionStore(createConditionStore('fr'));

    const t = await getTranslations();

    expect(t.obj('user.profile')).toEqual({
      name: 'Nom',
      greeting: 'Bonjour {name} !',
      title: 'Title',
    });
  });

  it('getTranslations obj scopes dictionary objects by root id', async () => {
    const cache = createCache(
      { defaultLocale: 'en', locales: ['en', 'fr'] },
      {
        dictionary: {
          metadata: {
            user: {
              name: 'Name',
              title: 'Title',
            },
          },
        },
        loadDictionary: vi.fn().mockResolvedValue({
          metadata: {
            user: {
              name: 'Nom',
            },
          },
        }),
      }
    );
    setI18nCache(cache);
    setWritableConditionStore(createConditionStore('fr'));

    const t = await getTranslations('metadata');

    expect(t.obj('user')).toEqual({
      name: 'Nom',
      title: 'Title',
    });
  });

  it('getTranslations obj falls back to translations for missing target leaves', async () => {
    const title = 'Title';
    const titleOptions = {
      $format: 'ICU',
      $context: 'profile title',
    } as const;
    const loadTranslations = vi.fn().mockResolvedValue({
      [hashMessage(title, titleOptions)]: 'Titre',
    });
    const cache = createCache(
      { defaultLocale: 'en', locales: ['en', 'fr'] },
      {
        dictionary: {
          user: {
            profile: {
              name: 'Name',
              title: [title, { $context: 'profile title' }],
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
        loadTranslations,
      }
    );
    setI18nCache(cache);
    setWritableConditionStore(createConditionStore('fr'));

    const t = await getTranslations();

    expect(t.obj('user.profile')).toEqual({
      name: 'Nom',
      title: 'Titre',
    });
    expect(loadTranslations).toHaveBeenCalledWith('fr');
  });
});
