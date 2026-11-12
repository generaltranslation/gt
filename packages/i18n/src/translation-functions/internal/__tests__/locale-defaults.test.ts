import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GTRuntime } from 'generaltranslation/runtime';
import { I18nCache } from '../../../i18n-cache/I18nCache';
import type {
  Dictionary,
  I18nCacheConstructorParams,
} from '../../../i18n-cache/types';
import { setI18nCache } from '../../../i18n-cache/singleton-operations';
import { setWritableConditionStore } from '../../../condition-store/singleton-operations';
import { initializeI18nConfig } from '../../../i18n-config/singleton-operations';
import type { I18nConfigParams } from '../../../i18n-config/I18nConfig';
import { msg } from '../../msg/msg';
import { hashMessage } from '../../../utils/hashMessage';
import { getGT, getGTInternal } from '../getGT';
import { getTranslations } from '../getTranslations';
import { getMessages } from '../getMessages';
import { tx, txInternal } from '../tx';

const message = 'Hello {name}!';
const icuHash = (source: string, $context?: string) =>
  hashMessage(source, { $format: 'ICU', ...($context && { $context }) });
const devHotReload = { devApiKey: 'dev-key', projectId: 'project-id' };

/** Registers a cache for en → fr (plus config overrides) with fr as the current locale */
function setup(
  cacheConfig: I18nCacheConstructorParams = {},
  i18nConfig: I18nConfigParams = {}
) {
  initializeI18nConfig({
    defaultLocale: 'en',
    locales: ['en', 'fr'],
    ...i18nConfig,
  });
  const cache = new I18nCache({
    loadTranslations: vi.fn().mockResolvedValue({}),
    ...cacheConfig,
  });
  setI18nCache(cache);
  setWritableConditionStore({
    getLocale: () => 'fr',
    getRegion: () => undefined,
    getEnableI18n: () => true,
    setLocale: () => {},
    setRegion: () => {},
    setEnableI18n: () => {},
  });
  return cache;
}

function setupTranslations(translations: Record<string, string>) {
  return setup({ loadTranslations: vi.fn().mockResolvedValue(translations) });
}

function setupDictionary(
  dictionary: Dictionary,
  loaded: Dictionary,
  cacheConfig: I18nCacheConstructorParams = {}
) {
  return setup({
    dictionary,
    loadDictionary: vi.fn().mockResolvedValue(loaded),
    ...cacheConfig,
  });
}

describe('translation function locale defaults', () => {
  beforeEach(() => {
    Reflect.deleteProperty(globalThis, '__generaltranslation');
    // Runtime translation must never reach the network.
    vi.spyOn(GTRuntime.prototype, 'translateMany').mockResolvedValue(
      {} as never
    );
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, '__generaltranslation');
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe('getGT', () => {
    it('uses the current locale without accepting a locale parameter', async () => {
      setupTranslations({ [icuHash(message)]: 'Bonjour {name} !' });

      const gt = await getGT();

      expect(gt(message, { name: 'Alice' })).toBe('Bonjour Alice !');
    });

    it('allows $locale to select another loaded locale', async () => {
      const cache = setup(
        {
          loadTranslations: vi.fn(async (locale: string) => ({
            [icuHash(message)]:
              locale === 'es' ? 'Hola {name}!' : 'Bonjour {name} !',
          })),
        },
        { locales: ['en', 'fr', 'es'] }
      );

      const gt = await getGT();
      await cache.loadTranslations('es');

      expect(gt(message, { $locale: 'es', name: 'Alice' })).toBe('Hola Alice!');
    });

    it('preloads compiler messages when dev hot reload is enabled', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      const cache = setup({}, devHotReload);
      const prefetchEntries = vi.fn();
      vi.spyOn(cache, 'getLookupTranslation').mockResolvedValue(
        Object.assign(vi.fn(), { prefetchEntries }) as Awaited<
          ReturnType<typeof cache.getLookupTranslation>
        >
      );

      await getGTInternal({ locale: 'fr', enableI18n: true }, [
        { message, $context: 'greeting' },
      ]);

      expect(prefetchEntries).toHaveBeenCalledWith([
        { message, options: { $context: 'greeting', $format: 'ICU' } },
      ]);
    });

    it('still returns a function when the dev hot reload preload rejects', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.useFakeTimers();
      const translateMany = vi
        .mocked(GTRuntime.prototype.translateMany)
        .mockRejectedValue(new Error('offline'));
      const cache = setup({}, devHotReload);

      const pending = getGTInternal({ locale: 'fr', enableI18n: true }, [
        { message },
      ]);
      // Flush the runtime-translation batch that the preload waits on
      await vi.advanceTimersByTimeAsync(50);
      const gt = await pending;

      expect(translateMany).toHaveBeenCalledTimes(1);
      // The fire-and-forget lookup of a still-missing message rejects too; an
      // unhandled rejection would fail this test.
      vi.spyOn(cache, 'lookupTranslationWithFallback').mockRejectedValue(
        new Error('offline')
      );
      expect(gt(message, { name: 'Alice' })).toBe('Hello Alice!');
    });

    it('catches fire-and-forget dev hot reload lookup rejections', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      const cache = setup({}, devHotReload);
      const catchHandler = vi.fn();
      vi.spyOn(cache, 'lookupTranslationWithFallback').mockReturnValue({
        catch: catchHandler,
      } as unknown as ReturnType<typeof cache.lookupTranslationWithFallback>);

      const gt = await getGTInternal({ locale: 'fr', enableI18n: true });

      expect(gt(message, { name: 'Alice' })).toBe('Hello Alice!');
      expect(catchHandler).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('getTranslations', () => {
    it('uses the current locale for dictionary entries, scoped by root id', async () => {
      setupDictionary(
        { greeting: message, metadata: { greeting: 'Welcome {name}!' } },
        {
          greeting: 'Bonjour {name} !',
          metadata: { greeting: 'Bienvenue {name} !' },
        }
      );

      const t = await getTranslations();
      const scoped = await getTranslations('metadata');

      expect(t('greeting', { name: 'Alice' })).toBe('Bonjour Alice !');
      expect(scoped('greeting', { name: 'Alice' })).toBe('Bienvenue Alice !');
    });

    it('returns source dictionary entries when no target translation exists', async () => {
      setupDictionary({ greeting: message }, {});

      const t = await getTranslations();

      expect(t('greeting', { name: 'Alice' })).toBe('Hello Alice!');
    });

    it.each([
      ['the loaded translations', undefined],
      ['async lookup snapshots when cacheExpiryTime is 0', 0],
    ])(
      'falls back to %s with source dictionary options',
      async (_name, cacheExpiryTime) => {
        const loadTranslations = vi.fn().mockResolvedValue({
          [icuHash(message, 'homepage')]: 'Bonjour {name} !',
        });
        const cache = setupDictionary(
          { greeting: [message, { $context: 'homepage' }] },
          {},
          { loadTranslations, cacheExpiryTime }
        );

        const t = await getTranslations();

        expect(t('greeting', { name: 'Alice' })).toBe('Bonjour Alice !');
        expect(loadTranslations).toHaveBeenCalledWith('fr');
        // With an expiry of 0 only the resolver's own snapshot holds the entry
        expect(
          cache.lookupTranslation('fr', message, {
            $format: 'ICU',
            $context: 'homepage',
          })
        ).toBe(cacheExpiryTime === 0 ? undefined : 'Bonjour {name} !');
      }
    );

    it('throws when the source dictionary entry or object is missing', async () => {
      setupDictionary({ greeting: 'Hello', user: { name: 'Name' } }, {});

      const t = await getTranslations();

      expect(() => t('missing')).toThrow(
        'Dictionary entry missing cannot be found'
      );
      expect(() => t.obj('missing')).toThrow(
        'Dictionary entry missing cannot be found'
      );
    });

    it('obj returns translated dictionary subtrees, scoped by root id', async () => {
      setupDictionary(
        {
          user: {
            profile: {
              name: 'Name',
              greeting: message,
              title: ['Title', { $context: 'profile title' }],
            },
          },
        },
        { user: { profile: { name: 'Nom', greeting: 'Bonjour {name} !' } } }
      );

      const t = await getTranslations();
      const scoped = await getTranslations('user');

      // Leaves missing from the target keep their source value
      const profile = {
        name: 'Nom',
        greeting: 'Bonjour {name} !',
        title: 'Title',
      };
      expect(t.obj('user.profile')).toEqual(profile);
      expect(scoped.obj('profile')).toEqual(profile);
    });

    it('obj falls back to translations for missing target leaves', async () => {
      const loadTranslations = vi.fn().mockResolvedValue({
        [icuHash('Title', 'profile title')]: 'Titre',
      });
      setupDictionary(
        {
          user: {
            profile: {
              name: 'Name',
              title: ['Title', { $context: 'profile title' }],
            },
          },
        },
        { user: { profile: { name: 'Nom' } } },
        { loadTranslations }
      );

      const t = await getTranslations();

      expect(t.obj('user.profile')).toEqual({ name: 'Nom', title: 'Titre' });
      expect(loadTranslations).toHaveBeenCalledWith('fr');
    });
  });

  it('getMessages uses the current locale without accepting a locale parameter', async () => {
    setupTranslations({ [icuHash(message)]: 'Bonjour {name} !' });

    const m = await getMessages();

    expect(m(msg(message, { name: 'Alice' }))).toBe('Bonjour Alice !');
  });

  describe('tx', () => {
    const translations = {
      [hashMessage('Hello', { $format: 'STRING' })]: 'Bonjour',
    };

    it('uses the current locale when $locale is omitted', async () => {
      setupTranslations(translations);

      await expect(tx('Hello')).resolves.toBe('Bonjour');
    });

    it('txInternal uses explicit $locale over the provided locale', async () => {
      setupTranslations(translations);

      await expect(
        txInternal({
          locale: 'en',
          enableI18n: true,
          content: 'Hello',
          options: { $locale: 'fr' },
        })
      ).resolves.toBe('Bonjour');
    });
  });
});
