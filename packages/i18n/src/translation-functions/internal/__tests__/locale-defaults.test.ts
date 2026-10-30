import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nCache } from '../../../i18n-cache/I18nCache';
import type { I18nCacheConstructorParams } from '../../../i18n-cache/types';
import { setI18nCache } from '../../../i18n-cache/singleton-operations';
import { setWritableConditionStore } from '../../../condition-store/singleton-operations';
import { initializeI18nConfig } from '../../../i18n-config/singleton-operations';
import type { I18nConfigParams } from '../../../i18n-config/I18nConfig';
import { msg } from '../../msg/msg';
import { hashMessage } from '../../../utils/hashMessage';
import { getGT, getGTInternal } from '../getGT';
import { getMessages } from '../getMessages';
import { tx, txInternal } from '../tx';

type TestGlobal = typeof globalThis & {
  __generaltranslation?: unknown;
};

function resetGTGlobals() {
  Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
}

describe('translation function locale defaults', () => {
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

  it('getGT preloads compiler messages when dev hot reload is enabled', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const cache = createCache(
      {
        defaultLocale: 'en',
        locales: ['en', 'fr'],
        devApiKey: 'dev-key',
        projectId: 'project-id',
      },
      {
        loadTranslations: vi.fn().mockResolvedValue({}),
      }
    );
    const prefetchEntries = vi.fn();
    vi.spyOn(cache, 'getLookupTranslation').mockResolvedValue(
      Object.assign(vi.fn(), { prefetchEntries }) as Awaited<
        ReturnType<typeof cache.getLookupTranslation>
      >
    );
    setI18nCache(cache);

    await getGTInternal({ locale: 'fr', enableI18n: true }, [
      { message: 'Hello {name}!', $context: 'greeting' },
    ]);

    expect(prefetchEntries).toHaveBeenCalledWith([
      {
        message: 'Hello {name}!',
        options: {
          $context: 'greeting',
          $format: 'ICU',
        },
      },
    ]);
  });

  it('getGT still returns a function when dev hot reload preload rejects', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const cache = createCache(
      {
        defaultLocale: 'en',
        locales: ['en', 'fr'],
        devApiKey: 'dev-key',
        projectId: 'project-id',
      },
      {
        loadTranslations: vi.fn().mockResolvedValue({}),
      }
    );
    vi.spyOn(cache, 'lookupTranslationWithFallback')
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(undefined);
    setI18nCache(cache);

    const gt = await getGTInternal({ locale: 'fr', enableI18n: true }, [
      { message: 'Hello {name}!' },
    ]);

    expect(gt('Hello {name}!', { name: 'Alice' })).toBe('Hello Alice!');
  });

  it('getGT catches fire-and-forget dev hot reload lookup rejections', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const cache = createCache(
      {
        defaultLocale: 'en',
        locales: ['en', 'fr'],
        devApiKey: 'dev-key',
        projectId: 'project-id',
      },
      {
        loadTranslations: vi.fn().mockResolvedValue({}),
      }
    );
    const catchHandler = vi.fn();
    vi.spyOn(cache, 'lookupTranslationWithFallback').mockReturnValue({
      catch: catchHandler,
    } as unknown as ReturnType<typeof cache.lookupTranslationWithFallback>);
    setI18nCache(cache);

    const gt = await getGTInternal({ locale: 'fr', enableI18n: true });

    expect(gt('Hello {name}!', { name: 'Alice' })).toBe('Hello Alice!');
    expect(catchHandler).toHaveBeenCalledWith(expect.any(Function));
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
