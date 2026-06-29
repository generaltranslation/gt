import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nCache } from '../../../i18n-cache/I18nCache';
import type { I18nCacheConstructorParams } from '../../../i18n-cache/types';
import { setI18nCache } from '../../../i18n-cache/singleton-operations';
import { setWritableConditionStore } from '../../../condition-store/singleton-operations';
import { initializeI18nConfig } from '../../../i18n-config/singleton-operations';
import type { I18nConfigParams } from '../../../i18n-config/I18nConfig';
import { msg } from '../../msg/msg';
import { hashMessage } from '../../../utils/hashMessage';
import { getGT } from '../getGT';
import { getTranslations } from '../getTranslations';
import { getMessages } from '../getMessages';
import { tx, txInternal } from '../tx';

describe('translation function locale defaults', () => {
  afterEach(() => {
    setWritableConditionStore(createConditionStore('en'));
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
    cacheConfig: I18nCacheConstructorParams = {}
  ) {
    initializeI18nConfig(i18nConfig);
    return new I18nCache(cacheConfig);
  }

  function setupManager(translations: Record<string, string>) {
    const cache = createCache(
      { defaultLocale: 'en', locales: ['en', 'fr'] },
      {
        loadTranslations: vi.fn().mockResolvedValue(translations),
      }
    );

    setI18nCache(cache);
    setWritableConditionStore(createConditionStore('fr'));

    return cache;
  }

  it('getGT uses the current locale without accepting a locale parameter', async () => {
    const message = 'Hello {name}!';
    setupManager({
      [hashMessage(message, { $format: 'ICU' })]: 'Bonjour {name} !',
    });

    const gt = await getGT();

    expect(gt(message, { name: 'Alice' })).toBe('Bonjour Alice !');
  });

  it('getGT allows $locale to select another loaded locale', async () => {
    const message = 'Hello {name}!';
    const cache = createCache(
      { defaultLocale: 'en', locales: ['en', 'fr', 'es'] },
      {
        loadTranslations: vi.fn().mockImplementation((locale: string) => ({
          [hashMessage(message, { $format: 'ICU' })]:
            locale === 'es' ? 'Hola {name}!' : 'Bonjour {name} !',
        })),
      }
    );
    setI18nCache(cache);
    setWritableConditionStore(createConditionStore('fr'));

    const gt = await getGT();
    await cache.loadTranslations('es');

    expect(gt(message, { $locale: 'es', name: 'Alice' })).toBe('Hola Alice!');
  });

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

  it('getMessages uses the current locale without accepting a locale parameter', async () => {
    const message = 'Hello {name}!';
    setupManager({
      [hashMessage(message, { $format: 'ICU' })]: 'Bonjour {name} !',
    });

    const m = await getMessages();

    expect(m(msg(message, { name: 'Alice' }))).toBe('Bonjour Alice !');
  });

  it('tx uses the current locale when $locale is omitted', async () => {
    const message = 'Hello';
    setupManager({
      [hashMessage(message, { $format: 'STRING' })]: 'Bonjour',
    });

    await expect(tx(message)).resolves.toBe('Bonjour');
  });

  it('txInternal uses explicit $locale over the provided locale', async () => {
    const message = 'Hello';
    const cache = createCache(
      { defaultLocale: 'en', locales: ['en', 'fr'] },
      {
        loadTranslations: vi.fn().mockResolvedValue({
          [hashMessage(message, { $format: 'STRING' })]: 'Bonjour',
        }),
      }
    );

    setI18nCache(cache);

    await expect(
      txInternal({
        locale: 'en',
        enableI18n: true,
        content: message,
        options: { $locale: 'fr' },
      })
    ).resolves.toBe('Bonjour');
  });
});
