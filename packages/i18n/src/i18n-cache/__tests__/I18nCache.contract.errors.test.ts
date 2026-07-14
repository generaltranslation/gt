import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GTRuntime } from 'generaltranslation/runtime';
import { I18nCache } from '../I18nCache';
import { initializeI18nConfig } from '../../i18n-config/singleton-operations';
import { hashMessage } from '../../utils/hashMessage';
import type { LookupOptions } from '../../translation-functions/types/options';

/**
 * Contract tests for I18nCache error semantics.
 *
 * Locks in the observable error behavior of the PUBLIC I18nCache API:
 * errors throw in development and are logged-and-swallowed in production,
 * except DictionarySourceNotFoundError which always propagates. These tests
 * import nothing from translations-manager/ and mock no internal modules.
 * getRuntimeEnvironment() treats every NODE_ENV except 'development' as
 * production, so vitest's default 'test' env exercises the production path.
 */

const message = 'Hello {name}!';
const lookupOptions: LookupOptions = {
  $format: 'ICU',
  $context: 'greeting',
};
const expectedHash = hashMessage(message, lookupOptions);
const translatedString = 'Bonjour {name} !';
const invalidLocale = 'not a locale!!';

type TestGlobal = typeof globalThis & {
  __generaltranslation?: unknown;
};

function resetGTGlobals() {
  Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
}

function createCache(overrides: Record<string, unknown> = {}) {
  return new I18nCache({
    loadTranslations: vi
      .fn()
      .mockResolvedValue({ [expectedHash]: translatedString }),
    ...overrides,
  });
}

describe('I18nCache error contract', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetGTGlobals();
    initializeI18nConfig({
      defaultLocale: 'en',
      locales: ['en', 'fr', 'es'],
    });
    consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    resetGTGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('production: invalid locale is logged and each read returns its fallback', async () => {
    const cache = createCache();

    expect(
      cache.lookupTranslation(invalidLocale, message, lookupOptions)
    ).toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('not valid')
    );

    await expect(cache.loadTranslations(invalidLocale)).resolves.toEqual({});
    await expect(cache.loadDictionary(invalidLocale)).resolves.toEqual({});
    expect(cache.lookupDictionary(invalidLocale, 'greeting')).toBeUndefined();
    expect(
      cache.lookupDictionaryObj(invalidLocale, 'greeting')
    ).toBeUndefined();

    // getLookupTranslation degrades to an identity resolver
    const resolver = await cache.getLookupTranslation(invalidLocale);
    expect(resolver(message, lookupOptions)).toBe(message);
  });

  it('development: invalid locale throws from sync reads and rejects from async reads', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const cache = createCache();

    expect(() =>
      cache.lookupTranslation(invalidLocale, message, lookupOptions)
    ).toThrow('not valid');
    expect(() => cache.lookupDictionary(invalidLocale, 'greeting')).toThrow(
      'not valid'
    );
    expect(() => cache.lookupDictionaryObj(invalidLocale, 'greeting')).toThrow(
      'not valid'
    );
    await expect(cache.loadTranslations(invalidLocale)).rejects.toThrow(
      'not valid'
    );
    await expect(cache.loadDictionary(invalidLocale)).rejects.toThrow(
      'not valid'
    );
    await expect(cache.getLookupTranslation(invalidLocale)).rejects.toThrow(
      'not valid'
    );
  });

  it.each([
    { name: 'production', env: undefined },
    { name: 'development', env: 'development' },
  ])(
    'DictionarySourceNotFoundError propagates from lookupDictionaryWithFallback in $name',
    async ({ env }) => {
      if (env) vi.stubEnv('NODE_ENV', env);
      const cache = createCache({
        dictionary: { greeting: 'Hello' },
        loadDictionary: vi.fn().mockResolvedValue({}),
      });

      await expect(
        cache.lookupDictionaryWithFallback('fr', 'missing')
      ).rejects.toMatchObject({
        name: 'DictionarySourceNotFoundError',
        message: 'I18nCache: source dictionary entry missing is not defined',
      });
    }
  );

  it.each([
    { name: 'production', env: undefined },
    { name: 'development', env: 'development' },
  ])(
    'DictionarySourceNotFoundError propagates from lookupDictionaryObjWithFallback in $name',
    async ({ env }) => {
      if (env) vi.stubEnv('NODE_ENV', env);
      const cache = createCache({
        dictionary: { greeting: 'Hello' },
        loadDictionary: vi.fn().mockResolvedValue({}),
      });

      await expect(
        cache.lookupDictionaryObjWithFallback('fr', 'missing')
      ).rejects.toMatchObject({
        name: 'DictionarySourceNotFoundError',
      });
    }
  );

  it('lookupDictionaryObjWithFallback returns the loaded target subtree when the source is missing', async () => {
    const cache = createCache({
      dictionary: { greeting: 'Hello' },
      loadDictionary: vi.fn().mockResolvedValue({
        extra: { title: 'Titre' },
      }),
    });

    await expect(
      cache.lookupDictionaryObjWithFallback('fr', 'extra')
    ).resolves.toEqual({ title: 'Titre' });
  });

  it('production: a failing translations loader is logged and swallowed', async () => {
    const cache = createCache({
      loadTranslations: vi.fn().mockRejectedValue(new Error('Load failed')),
    });

    await expect(cache.loadTranslations('fr')).resolves.toEqual({});
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Load failed')
    );

    // The fallback path also swallows the loader failure
    consoleErrorSpy.mockClear();
    await expect(
      cache.lookupTranslationWithFallback('fr', message, lookupOptions)
    ).resolves.toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
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

  it.each([
    { name: 'production', env: undefined },
    { name: 'development', env: 'development' },
  ])(
    'runtime translateMany rejection resolves undefined in production, rejects in development ($name)',
    async ({ env }) => {
      if (env) vi.stubEnv('NODE_ENV', env);
      vi.spyOn(GTRuntime.prototype, 'translateMany').mockRejectedValue(
        new Error('API down')
      );
      const cache = createCache({
        loadTranslations: vi.fn().mockResolvedValue({}),
        runtimeTranslation: {},
      });

      const lookup = cache.lookupTranslationWithFallback(
        'fr',
        message,
        lookupOptions
      );
      if (env === 'development') {
        await expect(lookup).rejects.toThrow('API down');
      } else {
        await expect(lookup).resolves.toBeUndefined();
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('API down')
        );
      }
    }
  );

  it('runtime translateMany success:false entry resolves undefined in production', async () => {
    vi.spyOn(GTRuntime.prototype, 'translateMany').mockResolvedValue({
      [expectedHash]: {
        success: false,
        error: new Error('nope'),
      },
    } as unknown as Awaited<ReturnType<GTRuntime['translateMany']>>);
    const cache = createCache({
      loadTranslations: vi.fn().mockResolvedValue({}),
      runtimeTranslation: {},
    });

    await expect(
      cache.lookupTranslationWithFallback('fr', message, lookupOptions)
    ).resolves.toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('nope')
    );
  });
});
