import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GTRuntime } from 'generaltranslation/runtime';
import { I18nCache } from '../I18nCache';
import type { TranslationsCacheMissEvent } from '../I18nCache';
import { hashMessage } from '../../utils/hashMessage';
import { LookupOptions } from '../../translation-functions/types/options';
import { initializeI18nConfig } from '../../i18n-config/singleton-operations';

/**
 * Contract tests for the I18nCache PUBLIC boundary (lookup API).
 *
 * These tests lock in the observable behavior consumers rely on so that the
 * internals (translations-manager, validation, loaders) can be restructured
 * freely. They must only exercise the I18nCache class itself (public methods
 * plus the protected onTranslationsCacheMiss hook) and stable helpers
 * (hashMessage, initializeI18nConfig). Do not import from or mock internal
 * module paths; runtime translation is observed by spying on
 * GTRuntime.prototype.translateMany.
 */

const message = 'Hello {name}!';
const lookupOptions: LookupOptions = {
  $format: 'ICU',
  $context: 'greeting',
};
const expectedHash = hashMessage(message, lookupOptions);
const translatedString = 'Bonjour {name} !';

type TestGlobal = typeof globalThis & {
  __generaltranslation?: unknown;
};

class TestI18nCache extends I18nCache {
  setTranslationsCacheMissListener(
    listener: (event: TranslationsCacheMissEvent) => void
  ) {
    this.onTranslationsCacheMiss = listener;
  }
}

function resetGTGlobals() {
  Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
}

function createCache(overrides: Record<string, unknown> = {}) {
  const {
    defaultLocale = 'en',
    locales = ['en', 'fr', 'es'],
    projectId,
    devApiKey,
    ...cacheOverrides
  } = overrides;
  resetGTGlobals();
  initializeI18nConfig({
    defaultLocale: defaultLocale as string,
    locales: locales as string[],
    projectId: projectId as string | undefined,
    devApiKey: devApiKey as string | undefined,
  });

  return new TestI18nCache({
    loadTranslations: vi
      .fn()
      .mockResolvedValue({ [expectedHash]: translatedString }),
    projectId: projectId as string | undefined,
    devApiKey: devApiKey as string | undefined,
    ...cacheOverrides,
  });
}

function spyOnTranslateMany() {
  return vi
    .spyOn(GTRuntime.prototype, 'translateMany')
    .mockResolvedValue({} as never);
}

describe('I18nCache contract: lookup API', () => {
  beforeEach(() => {
    resetGTGlobals();
    initializeI18nConfig({
      defaultLocale: 'en',
      locales: ['en', 'fr', 'es'],
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetGTGlobals();
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  // ===== getVersionId() ===== //

  it('getVersionId() returns the _versionId passed to the constructor', () => {
    const cache = createCache({ _versionId: 'version-abc' });

    expect(cache.getVersionId()).toBe('version-abc');
  });

  it('getVersionId() returns undefined when no _versionId was provided', () => {
    const cache = createCache();

    expect(cache.getVersionId()).toBeUndefined();
  });

  // ===== updateTranslations() ===== //

  it('updateTranslations() seeds a new locale for synchronous lookups', () => {
    const cache = createCache();

    expect(
      cache.lookupTranslation('es', message, lookupOptions)
    ).toBeUndefined();

    cache.updateTranslations({
      es: { [expectedHash]: 'Hola {name}!' },
    });

    expect(cache.lookupTranslation('es', message, lookupOptions)).toBe(
      'Hola {name}!'
    );
  });

  it('updateTranslations() merges into an already-loaded locale', async () => {
    const otherMessage = 'Goodbye {name}!';
    const otherOptions: LookupOptions = { $format: 'ICU' };
    const otherHash = hashMessage(otherMessage, otherOptions);
    const cache = createCache();

    await cache.loadTranslations('fr');

    cache.updateTranslations({
      fr: { [otherHash]: 'Au revoir {name} !' },
    });

    // New hash added, previously loaded hash retained
    expect(cache.lookupTranslation('fr', otherMessage, otherOptions)).toBe(
      'Au revoir {name} !'
    );
    expect(cache.lookupTranslation('fr', message, lookupOptions)).toBe(
      translatedString
    );

    // Updating the same hash overwrites the existing translation
    cache.updateTranslations({
      fr: { [expectedHash]: 'Salut {name} !' },
    });
    expect(cache.lookupTranslation('fr', message, lookupOptions)).toBe(
      'Salut {name} !'
    );
  });

  it('updateTranslations() does not fire onTranslationsCacheMiss', async () => {
    const cache = createCache();
    const onTranslationsCacheMiss = vi.fn();
    cache.setTranslationsCacheMissListener(onTranslationsCacheMiss);

    cache.updateTranslations({
      es: { [expectedHash]: 'Hola {name}!' },
    });
    await cache.loadTranslations('fr');
    cache.updateTranslations({
      fr: { [expectedHash]: 'Salut {name} !' },
    });

    expect(onTranslationsCacheMiss).not.toHaveBeenCalled();
  });

  // ===== getLookupTranslation() ===== //

  it('getLookupTranslation() returns an identity resolver for the default locale', async () => {
    const loadTranslations = vi.fn().mockResolvedValue({});
    const cache = createCache({ loadTranslations });

    const resolver = await cache.getLookupTranslation('en');

    expect(resolver(message, lookupOptions)).toBe(message);
    // Even unknown messages come back unchanged, with no load attempted
    expect(resolver('Anything at all')).toBe('Anything at all');
    expect(loadTranslations).not.toHaveBeenCalled();
  });

  it('getLookupTranslation() resolver resolves loaded translations and misses unknown hashes', async () => {
    const cache = createCache();

    const resolver = await cache.getLookupTranslation('fr');

    expect(resolver(message, lookupOptions)).toBe(translatedString);
    expect(resolver('Not translated', { $format: 'ICU' })).toBeUndefined();
  });

  it('getLookupTranslation() resolver honors options.$locale for other loaded locales', async () => {
    const loadTranslations = vi
      .fn()
      .mockImplementation(async (locale: string) => ({
        [expectedHash]: locale === 'fr' ? translatedString : 'Hola {name}!',
      }));
    const cache = createCache({ loadTranslations });

    const resolver = await cache.getLookupTranslation('fr');
    // Load the other locale so the override can resolve synchronously
    await cache.loadTranslations('es');

    expect(resolver(message, lookupOptions)).toBe(translatedString);
    expect(resolver(message, { ...lookupOptions, $locale: 'es' })).toBe(
      'Hola {name}!'
    );
  });

  it('getLookupTranslation() resolver returns undefined for an unloaded $locale override', async () => {
    const cache = createCache();

    const resolver = await cache.getLookupTranslation('fr');

    expect(
      resolver(message, { ...lookupOptions, $locale: 'es' })
    ).toBeUndefined();
  });

  it('getLookupTranslation() resolver returns the message for a default-locale $locale override', async () => {
    const cache = createCache();

    const resolver = await cache.getLookupTranslation('fr');

    expect(resolver(message, { ...lookupOptions, $locale: 'en' })).toBe(
      message
    );
  });

  it('getLookupTranslation() resolver exposes a prefetchEntries function', async () => {
    const cache = createCache();

    const resolver = await cache.getLookupTranslation('fr');

    expect(typeof resolver.prefetchEntries).toBe('function');
  });

  // ===== prefetchEntries ===== //

  it('prefetchEntries is a no-op when dev hot reload is disabled', async () => {
    const translateManySpy = spyOnTranslateMany();
    const cache = createCache({
      loadTranslations: vi.fn().mockResolvedValue({}),
    });

    const resolver = await cache.getLookupTranslation('fr');
    await resolver.prefetchEntries?.([{ message, options: lookupOptions }]);

    expect(translateManySpy).not.toHaveBeenCalled();
    expect(resolver(message, lookupOptions)).toBeUndefined();
  });

  it('prefetchEntries runtime-translates missing entries when dev hot reload is enabled', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const translateManySpy = spyOnTranslateMany().mockResolvedValue({
      [expectedHash]: {
        success: true,
        translation: 'Préchargé {name} !',
      },
    } as never);
    const cache = createCache({
      projectId: 'test-project',
      devApiKey: 'gtx-dev-key',
      loadTranslations: vi.fn().mockResolvedValue({}),
    });

    const resolver = await cache.getLookupTranslation('fr');
    await resolver.prefetchEntries?.([{ message, options: lookupOptions }]);

    expect(translateManySpy).toHaveBeenCalledTimes(1);
    const [sources, requestOptions] = translateManySpy.mock.calls[0];
    expect(Object.keys(sources as object)).toEqual([expectedHash]);
    expect(requestOptions).toMatchObject({ targetLocale: 'fr' });
    // The prefetched translation is now available synchronously
    expect(resolver(message, lookupOptions)).toBe('Préchargé {name} !');
  });

  it('prefetchEntries drops entries for other locales and warns', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const otherMessage = 'Other message';
    const otherOptions: LookupOptions = { $format: 'ICU', $locale: 'es' };
    const translateManySpy = spyOnTranslateMany().mockResolvedValue({
      [expectedHash]: {
        success: true,
        translation: 'Préchargé {name} !',
      },
    } as never);
    const cache = createCache({
      projectId: 'test-project',
      devApiKey: 'gtx-dev-key',
      loadTranslations: vi.fn().mockResolvedValue({}),
    });

    const resolver = await cache.getLookupTranslation('fr');
    await resolver.prefetchEntries?.([
      { message, options: lookupOptions },
      { message: otherMessage, options: otherOptions },
    ]);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('prefetchEntries must all be the same locale')
    );
    // Only the matching-locale entry is requested
    expect(translateManySpy).toHaveBeenCalledTimes(1);
    const [sources] = translateManySpy.mock.calls[0];
    expect(Object.keys(sources as object)).toEqual([expectedHash]);
  });

  it('prefetchEntries does not re-request entries already in the cache', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const translateManySpy = spyOnTranslateMany();
    const cache = createCache({
      projectId: 'test-project',
      devApiKey: 'gtx-dev-key',
    });

    const resolver = await cache.getLookupTranslation('fr');
    await resolver.prefetchEntries?.([{ message, options: lookupOptions }]);

    expect(translateManySpy).not.toHaveBeenCalled();
    expect(resolver(message, lookupOptions)).toBe(translatedString);
  });

  // ===== getLookupDictionary() ===== //

  it('getLookupDictionary() resolves the source dictionary for the default locale', async () => {
    const loadDictionary = vi.fn().mockResolvedValue({});
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

    const { lookupDictionary, lookupDictionaryObj } =
      await cache.getLookupDictionary('en');

    expect(lookupDictionary('greeting')).toEqual({
      entry: 'Hello',
      options: {},
    });
    expect(lookupDictionaryObj('user.profile')).toEqual({
      name: 'Name',
    });
    expect(loadDictionary).not.toHaveBeenCalled();
  });

  it('getLookupDictionary() resolves the loaded target dictionary for a translated locale', async () => {
    const cache = createCache({
      dictionary: {
        greeting: 'Hello',
        user: {
          profile: {
            name: 'Name',
          },
        },
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

    const { lookupDictionary, lookupDictionaryObj } =
      await cache.getLookupDictionary('fr');

    expect(lookupDictionary('greeting')).toEqual({
      entry: 'Bonjour',
      options: {},
    });
    expect(lookupDictionaryObj('user.profile')).toEqual({
      name: 'Nom',
    });
  });

  it('getLookupDictionary() resolvers return undefined for missing ids', async () => {
    const cache = createCache({
      dictionary: {
        greeting: 'Hello',
      },
      loadDictionary: vi.fn().mockResolvedValue({
        greeting: 'Bonjour',
      }),
    });

    const defaultResolvers = await cache.getLookupDictionary('en');
    const targetResolvers = await cache.getLookupDictionary('fr');

    expect(defaultResolvers.lookupDictionary('missing')).toBeUndefined();
    expect(defaultResolvers.lookupDictionaryObj('missing')).toBeUndefined();
    expect(targetResolvers.lookupDictionary('missing.path')).toBeUndefined();
    expect(targetResolvers.lookupDictionaryObj('missing.path')).toBeUndefined();
  });

  // ===== lookupTranslation() with options.$locale ===== //

  it('lookupTranslation() selects the cache by positional locale, not options.$locale', async () => {
    // current behavior: options.$locale does not redirect lookupTranslation();
    // the positional locale argument alone decides which locale cache is read
    // (and whether the message is returned as-is for the default locale).
    const loadTranslations = vi
      .fn()
      .mockImplementation(async (locale: string) => ({
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
