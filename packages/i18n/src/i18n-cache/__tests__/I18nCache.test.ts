/**
 * Tests for the I18nCache PUBLIC boundary: its public methods plus the
 * protected onTranslationsCacheMiss hook.
 *
 * They lock in the behavior consumers rely on so the internals
 * (translations-manager, validation, loaders) can be restructured freely. Do
 * not import or mock i18n-cache internals here; the only stubbed boundaries
 * are global fetch, console, env, timers and GTRuntime.prototype.translateMany.
 */
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type MockInstance,
} from 'vitest';
import { GTRuntime } from 'generaltranslation/runtime';
import { defaultCacheUrl } from 'generaltranslation/internal';
import type { CustomMapping } from '@generaltranslation/format/types';
import { I18nCache } from '../I18nCache';
import type { TranslationsCacheMissEvent } from '../I18nCache';
import type { Dictionary, I18nCacheConstructorParams } from '../types';
import { initializeI18nConfig } from '../../i18n-config/singleton-operations';
import { hashMessage } from '../../utils/hashMessage';
import type { LookupOptions } from '../../translation-functions/types/options';

const message = 'Hello {name}!';
const lookupOptions: LookupOptions = {
  $format: 'ICU',
  $context: 'greeting',
};
const expectedHash = hashMessage(message, lookupOptions);
const translatedString = 'Bonjour {name} !';
const icu: LookupOptions = { $format: 'ICU' };
const icuHash = (source: string) => hashMessage(source, icu);
const invalidLocale = 'not a locale!!';

// Characterized defaults: locale caches expire after 60 seconds and runtime
// translation misses are batched for 50ms.
const DEFAULT_TTL = 60_000;
const BATCH_INTERVAL = 50;

const brandBritish: CustomMapping = {
  'brand-british': { code: 'en-GB', name: 'Brand British' },
};

type LocaleConfig = {
  defaultLocale?: string;
  locales?: string[];
  customMapping?: CustomMapping;
};

class TestI18nCache extends I18nCache {
  setTranslationsCacheMissListener(
    listener: (event: TranslationsCacheMissEvent) => void
  ) {
    this.onTranslationsCacheMiss = listener;
  }
}

function resetGTGlobals() {
  Reflect.deleteProperty(globalThis, '__generaltranslation');
}

function initConfig(
  overrides: Parameters<typeof initializeI18nConfig>[0] = {}
) {
  resetGTGlobals();
  initializeI18nConfig({
    defaultLocale: 'en',
    locales: ['en', 'fr', 'es'],
    ...overrides,
  });
}

/** A cache whose loader serves the shared greeting, on a matching I18nConfig */
function createCache(
  overrides: I18nCacheConstructorParams & LocaleConfig = {}
) {
  const { defaultLocale, locales, customMapping, ...cacheOverrides } =
    overrides;
  initConfig({
    ...(defaultLocale && { defaultLocale }),
    ...(locales && { locales }),
    customMapping,
    projectId: cacheOverrides.projectId,
    devApiKey: cacheOverrides.devApiKey,
  });
  return new TestI18nCache({
    loadTranslations: vi
      .fn()
      .mockResolvedValue({ [expectedHash]: translatedString }),
    ...cacheOverrides,
  });
}

/** A successful translateMany response for the given hash → translation map */
function translated(translations: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(translations).map(([hash, translation]) => [
      hash,
      { success: true, translation },
    ])
  ) as never;
}

/** Flushes the runtime-translation batch timer, then hands back the lookup */
async function settle<T>(pending: Promise<T>): Promise<T> {
  // The caller asserts on the outcome once the batch has flushed.
  pending.catch(() => {});
  await vi.advanceTimersByTimeAsync(BATCH_INTERVAL);
  return pending;
}

/** Console calls whose first argument contains the given substring */
function callsContaining(spy: MockInstance, substring: string) {
  return spy.mock.calls.filter((call) => String(call[0]).includes(substring));
}

function mockFetchResponse(payload: unknown) {
  const fetchSpy = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(payload),
  });
  vi.stubGlobal('fetch', fetchSpy);
  return fetchSpy;
}

describe('I18nCache', () => {
  let translateMany: MockInstance<GTRuntime['translateMany']>;
  let warnSpy: MockInstance;
  let errorSpy: MockInstance;

  beforeEach(() => {
    initConfig();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    // Runtime translation never reaches the network; tests set the response.
    translateMany = vi
      .spyOn(GTRuntime.prototype, 'translateMany')
      .mockResolvedValue({} as never);
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    resetGTGlobals();
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('constructor validation', () => {
    it('throws and logs an error when loadDictionary is provided without a source dictionary', () => {
      expect(() => new I18nCache({ loadDictionary: async () => ({}) })).toThrow(
        'Validation errors occurred'
      );

      const errors = callsContaining(errorSpy, 'I18nCache:');
      expect(errors.length).toBe(1);
      expect(String(errors[0][0])).toContain(
        'loadDictionary needs a source dictionary'
      );
    });

    it('warns but does not throw when a custom runtimeUrl has no projectId or api keys', () => {
      expect(
        () =>
          new I18nCache({
            runtimeUrl: 'https://example.com/api',
            loadTranslations: async () => ({}),
          })
      ).not.toThrow();

      const warnings = callsContaining(warnSpy, 'I18nCache:');
      expect(warnings.length).toBe(2);
      expect(String(warnings[0][0])).toContain(
        'Runtime translation needs a projectId'
      );
      expect(String(warnings[1][0])).toContain(
        'Runtime translation needs devApiKey or apiKey'
      );
    });

    it('emits no validation warnings or errors for valid configs', () => {
      new I18nCache({
        projectId: 'test-project',
        apiKey: 'test-api-key',
        loadTranslations: async () => ({}),
      });
      new I18nCache({
        dictionary: { greeting: 'Hello' },
        loadDictionary: async () => ({}),
      });

      expect(callsContaining(warnSpy, 'I18nCache:').length).toBe(0);
      expect(callsContaining(errorSpy, 'I18nCache:').length).toBe(0);
    });

    it('getVersionId() returns the _versionId passed to the constructor', () => {
      expect(createCache({ _versionId: 'version-abc' }).getVersionId()).toBe(
        'version-abc'
      );
      expect(createCache().getVersionId()).toBeUndefined();
    });
  });

  describe('translation loader routing', () => {
    it('uses a custom loadTranslations loader and never fetches', async () => {
      const fetchSpy = mockFetchResponse({});
      const loadTranslations = vi
        .fn()
        .mockResolvedValue({ hash1: 'Bonjour le monde !' });
      const cache = new I18nCache({
        projectId: 'test-project',
        loadTranslations,
      });

      const translations = await cache.loadTranslations('fr');

      expect(loadTranslations).toHaveBeenCalledWith('fr');
      expect(translations).toEqual({ hash1: 'Bonjour le monde !' });
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it.each([
      ['the default GT cache URL', {}, `${defaultCacheUrl}/test-project/fr`],
      [
        'the _versionId segment and _branchId query',
        { _versionId: 'v123', _branchId: 'b9' },
        `${defaultCacheUrl}/test-project/fr/v123?branchId=b9`,
      ],
      [
        'a custom cacheUrl',
        { cacheUrl: 'https://cache.example.com' },
        'https://cache.example.com/test-project/fr',
      ],
    ])('fetches from %s when projectId is set', async (_name, params, url) => {
      const payload = { hash1: 'Bonjour le monde !' };
      const fetchSpy = mockFetchResponse(payload);
      const cache = new I18nCache({ projectId: 'test-project', ...params });

      expect(await cache.loadTranslations('fr')).toEqual(payload);
      expect(fetchSpy).toHaveBeenCalledExactlyOnceWith(url);
    });

    it.each(['en-gb', 'british'])(
      'requests the canonical locale from the remote store for %s',
      async (locale) => {
        const fetchSpy = mockFetchResponse({ hash: 'British translation' });
        const cache = createCache({
          defaultLocale: 'en-US',
          locales: ['en-US', locale],
          customMapping: { [locale]: { code: 'en-GB' } },
          loadTranslations: undefined,
          projectId: 'test-project',
          cacheUrl: 'https://example.com',
        });

        expect(await cache.loadTranslations(locale)).toEqual({
          hash: 'British translation',
        });
        expect(fetchSpy).toHaveBeenCalledExactlyOnceWith(
          'https://example.com/test-project/en-GB'
        );
      }
    );

    it.each([
      [
        'a custom cacheUrl has no projectId',
        { cacheUrl: 'https://cache.example.com' },
        'Loading translations from a remote store needs a projectId',
      ],
      [
        'no translation loader is configured',
        {},
        'No translation loader found',
      ],
    ])('warns once and returns {} when %s', async (_name, params, warning) => {
      const fetchSpy = mockFetchResponse({});
      const cache = new I18nCache(params);

      // The warning is deferred until the loader is actually invoked, and two
      // different locales force two loader invocations.
      expect(warnSpy).not.toHaveBeenCalled();
      expect(await cache.loadTranslations('fr')).toEqual({});
      expect(await cache.loadTranslations('es')).toEqual({});

      expect(warnSpy).toHaveBeenCalledExactlyOnceWith(
        expect.stringContaining(warning)
      );
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('returns {} silently when cacheUrl is null', async () => {
      const fetchSpy = mockFetchResponse({});
      const cache = new I18nCache({ cacheUrl: null });

      expect(await cache.loadTranslations('fr')).toEqual({});

      expect(warnSpy).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('logs and returns {} when the remote fetch fails', async () => {
      // vitest runs as production for getRuntimeEnvironment(), so load errors
      // are logged and swallowed instead of thrown
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: false, status: 404 })
      );
      const cache = new I18nCache({ projectId: 'test-project' });

      expect(await cache.loadTranslations('fr')).toEqual({});

      expect(
        callsContaining(errorSpy, 'Failed to load translations')
      ).toHaveLength(1);
    });
  });

  describe('locale identity', () => {
    it.each([
      {
        name: 'a configured locale of the same dialect',
        defaultLocale: 'en-US',
        locale: 'en',
      },
      {
        name: 'a custom alias for the default locale code',
        defaultLocale: 'en-us',
        locale: 'brand-us',
        customMapping: {
          'en-us': { code: 'en-US' },
          'brand-us': { code: 'en-US' },
        },
      },
    ])(
      'serves $name as source content without loading',
      async ({ defaultLocale, locale, customMapping }) => {
        const loadTranslations = vi
          .fn()
          .mockRejectedValue(new Error('No translations file'));
        const loadDictionary = vi
          .fn()
          .mockRejectedValue(new Error('No dictionary file'));
        const cache = createCache({
          defaultLocale,
          locales: [defaultLocale, locale, 'fr'],
          customMapping,
          loadTranslations,
          loadDictionary,
          dictionary: { greeting: 'Hello' },
        });

        const resolver = await cache.getLookupTranslation(locale);
        expect(resolver(message, lookupOptions)).toBe(message);
        expect(cache.lookupTranslation(locale, message, lookupOptions)).toBe(
          message
        );
        await expect(
          settle(cache.lookupTranslationWithFallback(locale, message, icu))
        ).resolves.toBe(message);
        await expect(cache.loadTranslations(locale)).resolves.toEqual({});
        await expect(cache.loadDictionary(locale)).resolves.toEqual({
          greeting: 'Hello',
        });
        expect(cache.lookupDictionary(locale, 'greeting')).toEqual({
          entry: 'Hello',
          options: {},
        });
        expect(loadTranslations).not.toHaveBeenCalled();
        expect(loadDictionary).not.toHaveBeenCalled();
        expect(translateMany).not.toHaveBeenCalled();
      }
    );

    it('uses the requested locale string as the cache key without resolving it', async () => {
      const loadTranslations = vi
        .fn()
        .mockResolvedValue({ [expectedHash]: translatedString });
      const cache = createCache({
        loadTranslations,
        locales: ['en', 'fr-fr', 'brand-french'],
        customMapping: { 'brand-french': { code: 'fr', name: 'Brand French' } },
      });
      // The first lookup builds the configured source-locale set.
      expect(cache.lookupTranslation('en', message, lookupOptions)).toBe(
        message
      );
      const canonicalize = vi.spyOn(Intl, 'getCanonicalLocales');
      try {
        await cache.loadTranslations('fr-FR');
        await cache.loadTranslations('fr-fr');
        await cache.loadTranslations('brand-french');
        const resolver = await cache.getLookupTranslation('fr-fr');
        expect(resolver(message, { ...lookupOptions, $locale: 'fr-fr' })).toBe(
          translatedString
        );
        expect(cache.lookupTranslation('fr-FR', message, lookupOptions)).toBe(
          translatedString
        );
        expect(canonicalize).not.toHaveBeenCalled();
      } finally {
        canonicalize.mockRestore();
      }
      expect(loadTranslations.mock.calls).toEqual([
        ['fr-FR'],
        ['fr-fr'],
        ['brand-french'],
      ]);
    });

    it.each([
      {
        name: 'requested dialect locale',
        locale: 'en-GB',
        translationLocale: 'en-GB',
      },
      {
        name: 'custom alias locale',
        locale: 'brand-british',
        translationLocale: 'brand-british',
        customMapping: brandBritish,
      },
    ])(
      'uses $name cache key when approved fallback is source-equivalent',
      async ({ locale, translationLocale, customMapping }) => {
        const translation = 'Hello there {name}!';
        const loadTranslations = vi
          .fn()
          .mockResolvedValue({ [expectedHash]: translation });
        const cache = createCache({
          defaultLocale: 'en-US',
          locales: ['en-US', 'en'],
          loadTranslations,
          customMapping,
        });

        const translations = await cache.loadTranslations(locale);

        expect(loadTranslations).toHaveBeenCalledExactlyOnceWith(
          translationLocale
        );
        expect(translations[expectedHash]).toBe(translation);
        expect(cache.lookupTranslation(locale, message, lookupOptions)).toBe(
          translation
        );
      }
    );

    it('lookupTranslation() selects the cache by positional locale, not options.$locale', async () => {
      // options.$locale does not redirect lookupTranslation(); the positional
      // locale argument alone decides which locale cache is read (and whether
      // the message is returned as-is for the default locale).
      const loadTranslations = vi.fn(async (locale: string) => ({
        [expectedHash]: locale === 'fr' ? translatedString : 'Hola {name}!',
      }));
      const cache = createCache({ loadTranslations });

      await cache.loadTranslations('fr');
      await cache.loadTranslations('es');

      expect(
        cache.lookupTranslation('fr', message, {
          ...lookupOptions,
          $locale: 'es',
        })
      ).toBe(translatedString);
      expect(
        cache.lookupTranslation('en', message, {
          ...lookupOptions,
          $locale: 'fr',
        })
      ).toBe(message);
    });
  });

  describe('translations', () => {
    it('lookupTranslation() returns undefined before load, translation after', async () => {
      const cache = createCache();

      expect(
        cache.lookupTranslation('fr', message, lookupOptions)
      ).toBeUndefined();

      await cache.loadTranslations('fr');

      expect(cache.lookupTranslation('fr', message, lookupOptions)).toBe(
        translatedString
      );
    });

    it('lookupTranslationWithFallback() loads and returns a translation without runtime translating', async () => {
      const cache = createCache();

      await expect(
        cache.lookupTranslationWithFallback('fr', message, lookupOptions)
      ).resolves.toBe(translatedString);
      expect(translateMany).not.toHaveBeenCalled();
    });

    it('updateTranslations() seeds a new locale for synchronous lookups', () => {
      const cache = createCache();

      expect(
        cache.lookupTranslation('es', message, lookupOptions)
      ).toBeUndefined();

      cache.updateTranslations({ es: { [expectedHash]: 'Hola {name}!' } });

      expect(cache.lookupTranslation('es', message, lookupOptions)).toBe(
        'Hola {name}!'
      );
    });

    it('updateTranslations() merges into an already-loaded locale', async () => {
      const otherMessage = 'Goodbye {name}!';
      const cache = createCache();

      await cache.loadTranslations('fr');
      cache.updateTranslations({
        fr: { [icuHash(otherMessage)]: 'Au revoir {name} !' },
      });

      // New hash added, previously loaded hash retained
      expect(cache.lookupTranslation('fr', otherMessage, icu)).toBe(
        'Au revoir {name} !'
      );
      expect(cache.lookupTranslation('fr', message, lookupOptions)).toBe(
        translatedString
      );

      // Updating the same hash overwrites the existing translation
      cache.updateTranslations({ fr: { [expectedHash]: 'Salut {name} !' } });
      expect(cache.lookupTranslation('fr', message, lookupOptions)).toBe(
        'Salut {name} !'
      );
    });

    it('updateTranslations() does not fire onTranslationsCacheMiss', async () => {
      const cache = createCache();
      const onTranslationsCacheMiss = vi.fn();
      cache.setTranslationsCacheMissListener(onTranslationsCacheMiss);

      cache.updateTranslations({ es: { [expectedHash]: 'Hola {name}!' } });
      await cache.loadTranslations('fr');
      cache.updateTranslations({ fr: { [expectedHash]: 'Salut {name} !' } });

      expect(onTranslationsCacheMiss).not.toHaveBeenCalled();
    });
  });

  describe('getLookupTranslation()', () => {
    it('returns an identity resolver for the default locale', async () => {
      const loadTranslations = vi.fn().mockResolvedValue({});
      const cache = createCache({ loadTranslations });

      const resolver = await cache.getLookupTranslation('en');

      expect(resolver(message, lookupOptions)).toBe(message);
      // Even unknown messages come back unchanged, with no load attempted
      expect(resolver('Anything at all')).toBe('Anything at all');
      expect(loadTranslations).not.toHaveBeenCalled();
    });

    it('resolves loaded translations and misses unknown hashes', async () => {
      const cache = createCache();

      const resolver = await cache.getLookupTranslation('fr');

      expect(resolver(message, lookupOptions)).toBe(translatedString);
      expect(resolver('Not translated', icu)).toBeUndefined();
    });

    it('honors options.$locale for the default locale and other loaded locales', async () => {
      const loadTranslations = vi.fn(async (locale: string) => ({
        [expectedHash]: locale === 'fr' ? translatedString : 'Hola {name}!',
      }));
      const cache = createCache({ loadTranslations });
      const spanish = { ...lookupOptions, $locale: 'es' };

      const resolver = await cache.getLookupTranslation('fr');

      expect(resolver(message, { ...lookupOptions, $locale: 'en' })).toBe(
        message
      );
      // Another locale only resolves synchronously once it has been loaded
      expect(resolver(message, spanish)).toBeUndefined();
      await cache.loadTranslations('es');
      expect(resolver(message, spanish)).toBe('Hola {name}!');
    });

    it('keeps the loaded snapshot when cacheExpiryTime is 0', async () => {
      const cache = createCache({
        cacheExpiryTime: 0,
        dictionary: { greeting: 'Hello', user: { profile: { name: 'Name' } } },
        loadDictionary: vi.fn().mockResolvedValue({
          greeting: 'Bonjour',
          user: { profile: { name: 'Nom' } },
        }),
      });

      const lookupTranslation = await cache.getLookupTranslation('fr');
      const { lookupDictionary, lookupDictionaryObj } =
        await cache.getLookupDictionary('fr');

      expect(
        cache.lookupTranslation('fr', message, lookupOptions)
      ).toBeUndefined();
      expect(cache.lookupDictionary('fr', 'greeting')).toBeUndefined();
      expect(cache.lookupDictionaryObj('fr', 'user.profile')).toBeUndefined();
      expect(lookupTranslation(message, lookupOptions)).toBe(translatedString);
      expect(lookupDictionary('greeting')).toEqual({
        entry: 'Bonjour',
        options: {},
      });
      expect(lookupDictionaryObj('user.profile')).toEqual({ name: 'Nom' });
    });

    describe('prefetchEntries', () => {
      const devCredentials = {
        projectId: 'test-project',
        devApiKey: 'gtx-dev-key',
      };
      const prefetched = translated({ [expectedHash]: 'Préchargé {name} !' });

      it('is a no-op when dev hot reload is disabled', async () => {
        const cache = createCache({
          loadTranslations: vi.fn().mockResolvedValue({}),
        });

        const resolver = await cache.getLookupTranslation('fr');
        await resolver.prefetchEntries?.([{ message, options: lookupOptions }]);

        expect(translateMany).not.toHaveBeenCalled();
        expect(resolver(message, lookupOptions)).toBeUndefined();
      });

      it('runtime-translates missing entries when dev hot reload is enabled', async () => {
        vi.stubEnv('NODE_ENV', 'development');
        translateMany.mockResolvedValue(prefetched);
        const cache = createCache({
          ...devCredentials,
          loadTranslations: vi.fn().mockResolvedValue({}),
        });

        const resolver = await cache.getLookupTranslation('fr');
        await settle(
          resolver.prefetchEntries!([{ message, options: lookupOptions }])
        );

        expect(translateMany).toHaveBeenCalledTimes(1);
        const [sources, requestOptions] = translateMany.mock.calls[0];
        expect(Object.keys(sources)).toEqual([expectedHash]);
        expect(requestOptions).toMatchObject({ targetLocale: 'fr' });
        // The prefetched translation is now available synchronously
        expect(resolver(message, lookupOptions)).toBe('Préchargé {name} !');
      });

      it('drops entries for other locales and warns', async () => {
        vi.stubEnv('NODE_ENV', 'development');
        translateMany.mockResolvedValue(prefetched);
        const cache = createCache({
          ...devCredentials,
          loadTranslations: vi.fn().mockResolvedValue({}),
        });

        const resolver = await cache.getLookupTranslation('fr');
        await settle(
          resolver.prefetchEntries!([
            { message, options: lookupOptions },
            { message: 'Other message', options: { ...icu, $locale: 'es' } },
          ])
        );

        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining('prefetchEntries must all be the same locale')
        );
        // Only the matching-locale entry is requested
        expect(translateMany).toHaveBeenCalledTimes(1);
        expect(Object.keys(translateMany.mock.calls[0][0])).toEqual([
          expectedHash,
        ]);
      });

      it('does not re-request entries already in the cache', async () => {
        vi.stubEnv('NODE_ENV', 'development');
        const cache = createCache(devCredentials);

        const resolver = await cache.getLookupTranslation('fr');
        await settle(
          resolver.prefetchEntries!([{ message, options: lookupOptions }])
        );

        expect(translateMany).not.toHaveBeenCalled();
        expect(resolver(message, lookupOptions)).toBe(translatedString);
      });
    });
  });

  describe('runtime translation', () => {
    it('passes runtimeTranslation timeout and metadata through to GTRuntime.translateMany', async () => {
      const options: LookupOptions = {
        ...lookupOptions,
        $id: 'greeting.hello',
        $maxChars: 40,
        $requiresReview: true,
      };
      const hash = hashMessage(message, options);
      translateMany.mockResolvedValue(translated({ [hash]: translatedString }));
      const cache = new I18nCache({
        loadTranslations: async () => ({}),
        runtimeTranslation: {
          timeout: 5000,
          metadata: { sourceLocale: 'en', modelProvider: 'test-provider' },
        },
      });

      await expect(
        settle(cache.lookupTranslationWithFallback('fr', message, options))
      ).resolves.toBe(translatedString);

      expect(translateMany).toHaveBeenCalledExactlyOnceWith(
        {
          [hash]: {
            source: message,
            metadata: {
              hash,
              context: 'greeting',
              id: 'greeting.hello',
              maxChars: 40,
              requiresReview: true,
              dataFormat: 'ICU',
            },
          },
        },
        {
          sourceLocale: 'en',
          modelProvider: 'test-provider',
          targetLocale: 'fr',
        },
        5000
      );
    });

    it('defaults the timeout to 12 seconds', async () => {
      const cache = new I18nCache({ loadTranslations: async () => ({}) });

      await settle(cache.lookupTranslationWithFallback('fr', 'Hello!', icu));

      expect(translateMany).toHaveBeenCalledExactlyOnceWith(
        expect.any(Object),
        { targetLocale: 'fr' },
        12_000
      );
    });

    it.each([
      ['forwards the top-level model provider', {}, 'anthropic'],
      [
        'prefers runtime translation metadata over the top-level model provider',
        { runtimeTranslation: { metadata: { modelProvider: 'openai' } } },
        'openai',
      ],
    ])('%s', async (_name, params, modelProvider) => {
      const cache = createCache({
        loadTranslations: async () => ({}),
        modelProvider: 'anthropic',
        ...params,
      });

      await settle(cache.lookupTranslationWithFallback('fr', 'Hello!', icu));

      expect(translateMany.mock.calls[0][1]).toEqual({
        targetLocale: 'fr',
        modelProvider,
      });
    });

    it('emits translations-cache-miss when a runtime translation resolves', async () => {
      const unknownMessage = 'Unknown message';
      const unknownHash = icuHash(unknownMessage);
      translateMany.mockResolvedValue(
        translated({ [unknownHash]: 'Message inconnu' })
      );
      const cache = createCache();
      const onTranslationsCacheMiss = vi.fn();
      cache.setTranslationsCacheMissListener(onTranslationsCacheMiss);

      await expect(
        settle(cache.lookupTranslationWithFallback('fr', unknownMessage, icu))
      ).resolves.toBe('Message inconnu');

      expect(onTranslationsCacheMiss).toHaveBeenCalledExactlyOnceWith({
        locale: 'fr',
        hash: unknownHash,
        translation: 'Message inconnu',
      });
    });

    it('deduplicates concurrent misses for the same message', async () => {
      const unknownMessage = 'Unknown message';
      const unknownHash = icuHash(unknownMessage);
      translateMany.mockResolvedValue(
        translated({ [unknownHash]: 'Message inconnu' })
      );
      const cache = createCache({
        loadTranslations: vi.fn().mockResolvedValue({}),
      });

      await expect(
        settle(
          Promise.all([
            cache.lookupTranslationWithFallback('fr', unknownMessage, icu),
            cache.lookupTranslationWithFallback('fr', unknownMessage, icu),
          ])
        )
      ).resolves.toEqual(['Message inconnu', 'Message inconnu']);

      expect(translateMany).toHaveBeenCalledTimes(1);
      expect(Object.keys(translateMany.mock.calls[0][0])).toEqual([
        unknownHash,
      ]);
    });

    it.each([
      ['batches concurrent misses into a single call', ['One', 'Two'], 1],
      [
        'splits misses that exceed maxBatchSize into separate calls',
        ['One', 'Two', 'Three'],
        2,
      ],
    ])('%s', async (_name, sources, calls) => {
      translateMany.mockImplementation(async (requests) =>
        translated(
          Object.fromEntries(Object.keys(requests).map((hash) => [hash, hash]))
        )
      );
      const cache = new I18nCache({
        loadTranslations: async () => ({}),
        batchConfig: { maxBatchSize: 2 },
      });

      const results = await settle(
        Promise.all(
          sources.map((source) =>
            cache.lookupTranslationWithFallback('fr', source, icu)
          )
        )
      );

      // The batching contract: no request exceeds maxBatchSize and each miss
      // is covered exactly once. Which miss lands in which batch is an
      // implementation detail.
      expect(results).toEqual(sources.map(icuHash));
      const batches = translateMany.mock.calls.map(([requests]) =>
        Object.keys(requests)
      );
      expect(batches).toHaveLength(calls);
      for (const batch of batches) {
        expect(batch.length).toBeLessThanOrEqual(2);
      }
      expect(batches.flat().sort()).toEqual(sources.map(icuHash).sort());
    });
  });

  describe('expiry', () => {
    it('expires translations after the default TTL and reloads on demand', async () => {
      const loadTranslations = vi
        .fn()
        .mockResolvedValueOnce({ [expectedHash]: translatedString })
        .mockResolvedValueOnce({ [expectedHash]: 'Salut {name} !' });
      const cache = createCache({ loadTranslations });

      await cache.loadTranslations('fr');

      // Just under the default TTL: still cached
      vi.advanceTimersByTime(DEFAULT_TTL - 1);
      expect(cache.lookupTranslation('fr', message, lookupOptions)).toBe(
        translatedString
      );

      // Past the default TTL: sync lookups miss
      vi.advanceTimersByTime(2);
      expect(
        cache.lookupTranslation('fr', message, lookupOptions)
      ).toBeUndefined();

      // Loading again invokes the loader a second time and repopulates
      const reloaded = await cache.loadTranslations('fr');
      expect(reloaded[expectedHash]).toBe('Salut {name} !');
      expect(loadTranslations).toHaveBeenCalledTimes(2);
      expect(cache.lookupTranslation('fr', message, lookupOptions)).toBe(
        'Salut {name} !'
      );
    });

    it('expires loaded dictionaries after the default TTL and reloads on demand', async () => {
      const loadDictionary = vi
        .fn()
        .mockResolvedValueOnce({ greeting: 'Bonjour' })
        .mockResolvedValueOnce({ greeting: 'Salut' });
      const cache = createCache({
        dictionary: { greeting: 'Hello' },
        loadDictionary,
      });

      // Two loads within the TTL share one loader call
      await cache.loadDictionary('fr');
      await cache.loadDictionary('fr');
      expect(loadDictionary).toHaveBeenCalledTimes(1);
      expect(cache.lookupDictionary('fr', 'greeting')).toEqual({
        entry: 'Bonjour',
        options: {},
      });

      // Past the default TTL: sync lookups miss
      vi.advanceTimersByTime(DEFAULT_TTL + 1);
      expect(cache.lookupDictionary('fr', 'greeting')).toBeUndefined();

      const reloaded = await cache.loadDictionary('fr');
      expect(loadDictionary).toHaveBeenCalledTimes(2);
      expect(reloaded).toEqual({ greeting: 'Salut' });
      expect(cache.lookupDictionary('fr', 'greeting')).toEqual({
        entry: 'Salut',
        options: {},
      });
    });

    it('cacheExpiryTime: null never expires translations or dictionaries', async () => {
      const loadTranslations = vi
        .fn()
        .mockResolvedValue({ [expectedHash]: translatedString });
      const loadDictionary = vi.fn().mockResolvedValue({ greeting: 'Bonjour' });
      const cache = createCache({
        cacheExpiryTime: null,
        loadTranslations,
        dictionary: { greeting: 'Hello' },
        loadDictionary,
      });

      await cache.loadTranslations('fr');
      await cache.loadDictionary('fr');

      vi.advanceTimersByTime(999_999_999);

      expect(cache.lookupTranslation('fr', message, lookupOptions)).toBe(
        translatedString
      );
      expect(cache.lookupDictionary('fr', 'greeting')).toEqual({
        entry: 'Bonjour',
        options: {},
      });

      // Re-loading does not hit the loaders again
      await cache.loadTranslations('fr');
      await cache.loadDictionary('fr');
      expect(loadTranslations).toHaveBeenCalledTimes(1);
      expect(loadDictionary).toHaveBeenCalledTimes(1);
    });

    it('never expires or loads the default-locale source dictionary', async () => {
      const loadDictionary = vi.fn().mockResolvedValue({ greeting: 'Bonjour' });
      const cache = createCache({
        dictionary: { greeting: 'Hello' },
        loadDictionary,
      });

      vi.advanceTimersByTime(999_999_999);

      expect(cache.lookupDictionary('en', 'greeting')).toEqual({
        entry: 'Hello',
        options: {},
      });
      await expect(cache.loadDictionary('en')).resolves.toEqual({
        greeting: 'Hello',
      });
      expect(loadDictionary).not.toHaveBeenCalled();
    });

    it('starts the TTL when the load resolves, not when it starts', async () => {
      let resolveTranslations!: (translations: Record<string, string>) => void;
      const loadTranslations = vi.fn().mockReturnValue(
        new Promise((resolve) => {
          resolveTranslations = resolve;
        })
      );
      const cache = createCache({ cacheExpiryTime: 5000, loadTranslations });

      const loadPromise = cache.loadTranslations('fr');
      vi.advanceTimersByTime(4000);
      resolveTranslations({ [expectedHash]: translatedString });
      await loadPromise;

      // 4999ms after the load resolved: still cached
      vi.advanceTimersByTime(4999);
      expect(cache.lookupTranslation('fr', message, lookupOptions)).toBe(
        translatedString
      );

      // Past the TTL measured from resolution: expired
      vi.advanceTimersByTime(2);
      expect(
        cache.lookupTranslation('fr', message, lookupOptions)
      ).toBeUndefined();
    });

    it('loads lazily and deduplicates concurrent loads for the same locale', async () => {
      const loadTranslations = vi
        .fn()
        .mockResolvedValue({ [expectedHash]: translatedString });
      const loadDictionary = vi.fn().mockResolvedValue({ greeting: 'Bonjour' });
      const cache = createCache({
        loadTranslations,
        dictionary: { greeting: 'Hello' },
        loadDictionary,
      });
      expect(loadTranslations).not.toHaveBeenCalled();
      expect(loadDictionary).not.toHaveBeenCalled();

      const [translationsA, translationsB] = await Promise.all([
        cache.loadTranslations('fr'),
        cache.loadTranslations('fr'),
      ]);
      const [dictionaryA, dictionaryB] = await Promise.all([
        cache.loadDictionary('fr'),
        cache.loadDictionary('fr'),
      ]);

      expect(loadTranslations).toHaveBeenCalledExactlyOnceWith('fr');
      expect(loadDictionary).toHaveBeenCalledExactlyOnceWith('fr');
      expect(translationsA).toEqual(translationsB);
      expect(dictionaryA).toEqual({ greeting: 'Bonjour' });
      expect(dictionaryB).toEqual({ greeting: 'Bonjour' });
    });
  });

  describe('dictionaries', () => {
    const source: Dictionary = {
      greeting: 'Hello',
      header: ['Welcome', { $context: 'homepage', $maxChars: 10 }],
      user: { profile: { name: 'Name', title: 'Title' } },
    };
    const target: Dictionary = {
      greeting: 'Bonjour',
      header: ['Bienvenue', { $context: 'homepage' }],
      user: { profile: { name: 'Nom' } },
    };

    function createDictionaryCache(
      loaded: Dictionary = target,
      overrides: I18nCacheConstructorParams & LocaleConfig = {}
    ) {
      const loadDictionary = vi.fn().mockResolvedValue(loaded);
      const cache = createCache({
        dictionary: source,
        loadDictionary,
        ...overrides,
      });
      return { cache, loadDictionary };
    }

    it('loadDictionary() loads once and returns deep copies', async () => {
      const { cache, loadDictionary } = createDictionaryCache();

      const dictionary = (await cache.loadDictionary('fr')) as {
        greeting: string;
        user: { profile: { name: string } };
      };
      const cachedDictionary = await cache.loadDictionary('fr');

      expect(loadDictionary).toHaveBeenCalledExactlyOnceWith('fr');
      expect(dictionary).toEqual(target);
      expect(cachedDictionary).toEqual(dictionary);
      expect(cachedDictionary).not.toBe(dictionary);

      dictionary.greeting = 'Salut';
      dictionary.user.profile.name = 'Changed';
      await expect(cache.loadDictionary('fr')).resolves.toEqual(target);
    });

    it('updateDictionaries() merges into source and target dictionaries', () => {
      const cache = createCache({
        dictionary: {
          greeting: 'Hello',
          cta: 'Click me',
          navigation: { about: 'About' },
        },
      });

      cache.updateDictionaries({
        en: { greeting: 'Hi', navigation: { home: 'Home' } },
        fr: { greeting: 'Bonjour', navigation: { home: 'Accueil' } },
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

    describe('for a dialect locale', () => {
      const british: Dictionary = {
        greeting: 'Hello mate',
        header: ['Welcome mate', { $context: 'homepage' }],
        user: { profile: { name: 'Mate', title: 'Boss' } },
      };

      it.each([
        [
          'loadDictionary()',
          (cache: I18nCache) => cache.loadDictionary('en-GB'),
          british,
        ],
        [
          'lookupDictionaryWithFallback()',
          (cache: I18nCache) =>
            cache.lookupDictionaryWithFallback('en-GB', 'greeting'),
          { entry: 'Hello mate', options: {} },
        ],
        [
          'lookupDictionaryObjWithFallback()',
          (cache: I18nCache) =>
            cache.lookupDictionaryObjWithFallback('en-GB', 'user.profile'),
          { name: 'Mate', title: 'Boss' },
        ],
      ])('%s uses the cache locale', async (_method, read, expected) => {
        const { cache, loadDictionary } = createDictionaryCache(british, {
          defaultLocale: 'en-US',
          locales: ['en-US', 'en'],
        });

        await expect(read(cache)).resolves.toEqual(expected);

        expect(loadDictionary).toHaveBeenCalledExactlyOnceWith('en-GB');
        expect(cache.lookupDictionary('en-GB', 'greeting')).toEqual({
          entry: 'Hello mate',
          options: {},
        });
      });
    });

    it('lookupDictionary() returns loaded target leaves, never subtrees', async () => {
      const { cache } = createDictionaryCache();

      await cache.loadDictionary('fr');

      expect(cache.lookupDictionary('fr', 'greeting')).toEqual({
        entry: 'Bonjour',
        options: {},
      });
      expect(cache.lookupDictionary('fr', 'user.profile.name')).toEqual({
        entry: 'Nom',
        options: {},
      });
      // A metadata tuple leaf yields its entry and its own options
      expect(cache.lookupDictionary('fr', 'header')).toEqual({
        entry: 'Bienvenue',
        options: { $context: 'homepage' },
      });
      expect(cache.lookupDictionary('fr', 'user.profile')).toBeUndefined();
      // Missing in the target, present in the source
      expect(
        cache.lookupDictionary('fr', 'user.profile.title')
      ).toBeUndefined();
      expect(cache.lookupDictionary('en', 'user.profile.title')).toEqual({
        entry: 'Title',
        options: {},
      });
    });

    it('lookupDictionary() and lookupDictionaryObj() miss unloaded locales and unknown ids', async () => {
      const { cache } = createDictionaryCache();

      expect(cache.lookupDictionary('fr', 'greeting')).toBeUndefined();
      expect(cache.lookupDictionaryObj('fr', 'user.profile')).toBeUndefined();
      expect(cache.lookupDictionary('en', 'greeting')).toEqual({
        entry: 'Hello',
        options: {},
      });

      await cache.loadDictionary('fr');

      for (const locale of ['en', 'fr']) {
        expect(cache.lookupDictionary(locale, 'missing')).toBeUndefined();
        expect(cache.lookupDictionaryObj(locale, 'missing')).toBeUndefined();
      }
    });

    it('lookupDictionaryObj() returns leaves and copies of subtrees', async () => {
      const { cache } = createDictionaryCache();

      await cache.loadDictionary('fr');

      expect(cache.lookupDictionaryObj('en', 'greeting')).toBe('Hello');
      expect(cache.lookupDictionaryObj('fr', 'greeting')).toBe('Bonjour');
      expect(cache.lookupDictionaryObj('fr', 'user.profile')).toEqual({
        name: 'Nom',
      });

      const profile = cache.lookupDictionaryObj('en', 'user.profile');
      expect(profile).toEqual({ name: 'Name', title: 'Title' });
      (profile as { name: string }).name = 'Changed';
      expect(cache.lookupDictionaryObj('en', 'user.profile')).toEqual({
        name: 'Name',
        title: 'Title',
      });
    });

    it('lookupDictionaryObj() does not clone leaf values', async () => {
      const { cache } = createDictionaryCache();
      await cache.loadDictionary('fr');
      const structuredCloneSpy = vi.spyOn(globalThis, 'structuredClone');

      expect(cache.lookupDictionaryObj('fr', 'greeting')).toBe('Bonjour');
      expect(structuredCloneSpy).not.toHaveBeenCalled();
    });

    it('getLookupDictionary() resolves the source dictionary for the default locale', async () => {
      const { cache, loadDictionary } = createDictionaryCache();

      const { lookupDictionary, lookupDictionaryObj } =
        await cache.getLookupDictionary('en');

      expect(lookupDictionary('greeting')).toEqual({
        entry: 'Hello',
        options: {},
      });
      expect(lookupDictionaryObj('user.profile')).toEqual({
        name: 'Name',
        title: 'Title',
      });
      expect(lookupDictionary('missing')).toBeUndefined();
      expect(lookupDictionaryObj('missing')).toBeUndefined();
      expect(loadDictionary).not.toHaveBeenCalled();
    });

    it('getLookupDictionary() resolves the loaded target dictionary for a translated locale', async () => {
      const { cache } = createDictionaryCache();

      const { lookupDictionary, lookupDictionaryObj } =
        await cache.getLookupDictionary('fr');

      expect(lookupDictionary('greeting')).toEqual({
        entry: 'Bonjour',
        options: {},
      });
      expect(lookupDictionaryObj('user.profile')).toEqual({ name: 'Nom' });
      expect(lookupDictionary('missing.path')).toBeUndefined();
      expect(lookupDictionaryObj('missing.path')).toBeUndefined();
    });

    describe('with fallback', () => {
      it('returns the source dictionary for the default locale without loading', async () => {
        const { cache, loadDictionary } = createDictionaryCache();

        await expect(
          cache.lookupDictionaryWithFallback('en', 'greeting')
        ).resolves.toEqual({ entry: 'Hello', options: {} });
        await expect(
          cache.lookupDictionaryObjWithFallback('en', 'greeting')
        ).resolves.toBe('Hello');
        await expect(
          cache.lookupDictionaryObjWithFallback('en', 'user.profile')
        ).resolves.toEqual({ name: 'Name', title: 'Title' });
        expect(loadDictionary).not.toHaveBeenCalled();
      });

      it.each([
        [
          'lookupDictionaryWithFallback() returns a loaded target entry',
          (cache: I18nCache) =>
            cache.lookupDictionaryWithFallback('fr', 'greeting'),
          { entry: 'Bonjour', options: {} },
          [],
        ],
        [
          'lookupDictionaryObjWithFallback() fills only the leaves a loaded target subtree lacks',
          (cache: I18nCache) =>
            cache.lookupDictionaryObjWithFallback('fr', 'user.profile'),
          { name: 'Nom', title: 'Titre' },
          [icuHash('Title')],
        ],
      ])('%s', async (_name, read, expected, misses) => {
        translateMany.mockResolvedValue(
          translated({ [icuHash('Title')]: 'Titre' })
        );
        const { cache, loadDictionary } = createDictionaryCache();

        await expect(settle<unknown>(read(cache))).resolves.toEqual(expected);

        expect(loadDictionary).toHaveBeenCalledExactlyOnceWith('fr');
        expect(
          translateMany.mock.calls.flatMap(([sources]) => Object.keys(sources))
        ).toEqual(misses);
        expect(cache.lookupDictionaryObj('fr', 'user.profile')).toEqual(
          misses.length ? expected : { name: 'Nom' }
        );
      });

      it.each([
        ['a plain string as ICU', 'Hello {name}', icu],
        [
          'a tuple without a format as ICU with its context',
          ['Hello {name}', { $context: 'homepage' }],
          { $format: 'ICU', $context: 'homepage' },
        ],
        [
          'a tuple with its own format and context',
          ['Hello {name}', { $format: 'I18NEXT', $context: 'homepage' }],
          { $format: 'I18NEXT', $context: 'homepage' },
        ],
      ] as const)(
        'lookupDictionaryWithFallback() runtime translates and caches %s',
        async (_name, entry, sourceOptions) => {
          translateMany.mockResolvedValue(
            translated({
              [hashMessage('Hello {name}', sourceOptions)]: 'Bonjour {name}',
            })
          );
          // No loadDictionary: the target dictionary starts out empty
          const cache = createCache({
            dictionary: { greeting: entry } as never,
          });

          await expect(
            settle(cache.lookupDictionaryWithFallback('fr', 'greeting'))
          ).resolves.toEqual({ entry: 'Bonjour {name}', options: {} });
          expect(cache.lookupDictionary('fr', 'greeting')).toEqual({
            entry: 'Bonjour {name}',
            options: {},
          });
        }
      );

      it('lookupDictionaryObjWithFallback() runtime translates and caches missing subtrees', async () => {
        translateMany.mockResolvedValue(
          translated({ [icuHash('Name')]: 'Nom', [icuHash('Title')]: 'Titre' })
        );
        const { cache } = createDictionaryCache({});

        await expect(
          settle(cache.lookupDictionaryObjWithFallback('fr', 'user.profile'))
        ).resolves.toEqual({ name: 'Nom', title: 'Titre' });
        expect(cache.lookupDictionaryObj('fr', 'user.profile')).toEqual({
          name: 'Nom',
          title: 'Titre',
        });
      });

      it('lookupDictionaryObjWithFallback() returns loaded target subtrees when the source is missing', async () => {
        const { cache } = createDictionaryCache({
          extra: { label: 'Supplement' },
        });

        await expect(
          cache.lookupDictionaryObjWithFallback('fr', 'extra')
        ).resolves.toEqual({ label: 'Supplement' });
        expect(translateMany).not.toHaveBeenCalled();
      });

      it('lookupDictionaryWithFallback() rejects when the runtime translation is not a string', async () => {
        vi.stubEnv('NODE_ENV', 'development');
        translateMany.mockResolvedValue(
          translated({ [icuHash('Hello')]: ['Bonjour'] })
        );
        const { cache } = createDictionaryCache({});

        await expect(
          settle(cache.lookupDictionaryWithFallback('fr', 'greeting'))
        ).rejects.toThrow(
          'Dictionary entry "greeting" could not be translated into a string. Check the source entry and translation loader output.'
        );
      });

      // DictionarySourceNotFoundError always propagates, in every environment
      // and whether or not the locale requires translation.
      it.each([
        ['production', 'fr'],
        ['development', 'fr'],
        ['production', 'en'],
      ])(
        'rejects a missing source entry in %s for %s',
        async (environment, locale) => {
          vi.stubEnv('NODE_ENV', environment);
          const { cache } = createDictionaryCache({});
          const sourceNotFound = {
            name: 'DictionarySourceNotFoundError',
            message:
              'I18nCache: source dictionary entry missing is not defined',
          };

          await expect(
            cache.lookupDictionaryWithFallback(locale, 'missing')
          ).rejects.toMatchObject(sourceNotFound);
          await expect(
            cache.lookupDictionaryObjWithFallback(locale, 'missing')
          ).rejects.toMatchObject(sourceNotFound);
        }
      );
    });
  });

  // Errors throw in development and are logged-and-swallowed in production.
  // getRuntimeEnvironment() treats every NODE_ENV except 'development' as
  // production, so vitest's default 'test' env exercises the production path.
  describe('error handling', () => {
    it('development: an unknown locale reads as a miss without logging or throwing', () => {
      vi.stubEnv('NODE_ENV', 'development');
      const cache = createCache();

      expect(
        cache.lookupTranslation(invalidLocale, message, lookupOptions)
      ).toBeUndefined();
      expect(cache.lookupDictionary(invalidLocale, 'greeting')).toBeUndefined();
      expect(
        cache.lookupDictionaryObj(invalidLocale, 'greeting')
      ).toBeUndefined();
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('production: a failing translations loader is logged and swallowed', async () => {
      const cache = createCache({
        loadTranslations: vi.fn().mockRejectedValue(new Error('Load failed')),
      });

      await expect(cache.loadTranslations('fr')).resolves.toEqual({});
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Load failed')
      );

      // The fallback path also swallows the loader failure
      errorSpy.mockClear();
      await expect(
        cache.lookupTranslationWithFallback('fr', message, lookupOptions)
      ).resolves.toBeUndefined();
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Load failed')
      );
    });

    it('development: a failing translations loader rejects', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      const cache = createCache({
        loadTranslations: vi.fn().mockRejectedValue(new Error('Load failed')),
      });

      await expect(cache.loadTranslations('fr')).rejects.toThrow('Load failed');
      await expect(
        cache.lookupTranslationWithFallback('fr', message, lookupOptions)
      ).rejects.toThrow('Load failed');
    });

    it.each(['production', 'development'])(
      '%s: a runtime translateMany rejection is swallowed in production and rejects in development',
      async (environment) => {
        vi.stubEnv('NODE_ENV', environment);
        translateMany.mockRejectedValue(new Error('API down'));
        const cache = createCache({
          loadTranslations: vi.fn().mockResolvedValue({}),
        });

        const lookup = settle(
          cache.lookupTranslationWithFallback('fr', message, lookupOptions)
        );
        if (environment === 'development') {
          await expect(lookup).rejects.toThrow('API down');
        } else {
          await expect(lookup).resolves.toBeUndefined();
          expect(errorSpy).toHaveBeenCalledWith(
            expect.stringContaining('API down')
          );
        }
      }
    );

    it('production: a runtime translateMany success:false entry resolves undefined', async () => {
      translateMany.mockResolvedValue({
        [expectedHash]: { success: false, error: new Error('nope') },
      } as never);
      const cache = createCache({
        loadTranslations: vi.fn().mockResolvedValue({}),
      });

      await expect(
        settle(
          cache.lookupTranslationWithFallback('fr', message, lookupOptions)
        )
      ).resolves.toBeUndefined();
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('nope'));
    });
  });
});
