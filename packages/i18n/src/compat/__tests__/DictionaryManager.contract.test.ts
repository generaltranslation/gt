/**
 * Contract tests for the DictionaryManager public boundary: constructor
 * validation, error semantics, locale-cache expiry and async lookups. Moved
 * from the I18nCache contract suites when dictionaries left I18nCache.
 * Runtime translation is observed only through GTRuntime.prototype.
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
import { I18nCache } from '../../i18n-cache/I18nCache';
import { initializeI18nConfig } from '../../i18n-config/singleton-operations';
import { hashMessage } from '../../utils/hashMessage';
import type { LookupOptions } from '../../translation-functions/types/options';
import { DictionaryManager } from '../DictionaryManager';
import { createDictionaryHarness } from './dictionaryHarness';

const message = 'Hello {name}!';
const lookupOptions: LookupOptions = {
  $format: 'ICU',
  $context: 'greeting',
};
const expectedHash = hashMessage(message, lookupOptions);
const translatedString = 'Bonjour {name} !';
const invalidLocale = 'not a locale!!';

// Characterized default: locale caches expire after 60 seconds.
const DEFAULT_TTL = 60_000;

type TestGlobal = typeof globalThis & {
  __generaltranslation?: unknown;
};

function resetGTGlobals() {
  Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
}

function initConfig() {
  resetGTGlobals();
  initializeI18nConfig({
    defaultLocale: 'en',
    locales: ['en', 'fr', 'es'],
  });
}

function createCache(overrides: Record<string, unknown> = {}) {
  const { dictionary, loadDictionary, ...cacheOverrides } = overrides;
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

/** Console calls whose first argument contains the given substring */
function callsContaining(spy: MockInstance, substring: string) {
  return spy.mock.calls.filter((call) => String(call[0]).includes(substring));
}

describe('DictionaryManager config contract', () => {
  let errorSpy: MockInstance;

  beforeEach(() => {
    initConfig();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    resetGTGlobals();
    vi.restoreAllMocks();
  });

  it('throws and logs an error when loadDictionary is provided without a source dictionary', () => {
    expect(
      () =>
        new DictionaryManager({
          loadDictionary: async () => ({}),
        })
    ).toThrow('Validation errors occurred');

    const errors = callsContaining(errorSpy, 'DictionaryManager:');
    expect(errors.length).toBe(1);
    expect(String(errors[0][0])).toContain(
      'loadDictionary needs a source dictionary'
    );
  });

  it('accepts loadDictionary when a source dictionary is provided', () => {
    expect(
      () =>
        new DictionaryManager({
          dictionary: { greeting: 'Hello' },
          loadDictionary: async () => ({}),
        })
    ).not.toThrow();
    expect(callsContaining(errorSpy, 'DictionaryManager:').length).toBe(0);
  });

  it('loads the dictionary lazily and deduplicates concurrent loads', async () => {
    const loadDictionary = vi.fn().mockResolvedValue({ greeting: 'Bonjour' });
    const cache = createCache({
      loadTranslations: async () => ({}),
      dictionary: { greeting: 'Hello' },
      loadDictionary,
    });

    expect(loadDictionary).not.toHaveBeenCalled();

    const [first, second] = await Promise.all([
      cache.loadDictionary('fr'),
      cache.loadDictionary('fr'),
    ]);

    expect(loadDictionary).toHaveBeenCalledTimes(1);
    expect(loadDictionary).toHaveBeenCalledWith('fr');
    expect(first).toEqual({ greeting: 'Bonjour' });
    expect(second).toEqual({ greeting: 'Bonjour' });
  });
});

describe('DictionaryManager error contract', () => {
  beforeEach(() => {
    initConfig();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    resetGTGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('production: invalid locale is logged and each read returns its fallback', async () => {
    const cache = createCache();

    await expect(cache.loadDictionary(invalidLocale)).resolves.toEqual({});
    expect(cache.lookupDictionary(invalidLocale, 'greeting')).toBeUndefined();
    expect(
      cache.lookupDictionaryObj(invalidLocale, 'greeting')
    ).toBeUndefined();
  });

  it('development: invalid locale throws from sync reads and rejects from async reads', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const cache = createCache();

    expect(() => cache.lookupDictionary(invalidLocale, 'greeting')).toThrow(
      'not valid'
    );
    expect(() => cache.lookupDictionaryObj(invalidLocale, 'greeting')).toThrow(
      'not valid'
    );
    await expect(cache.loadDictionary(invalidLocale)).rejects.toThrow(
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
});

describe('DictionaryManager expiry contract', () => {
  beforeEach(() => {
    initConfig();
  });

  afterEach(() => {
    resetGTGlobals();
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('cacheExpiryTime: null never expires translations or dictionaries', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
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

  it('expires loaded dictionaries after the default TTL and reloads on demand', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
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

  it('never expires the default-locale source dictionary', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
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

  it('deduplicates concurrent loads for the same locale', async () => {
    const loadTranslations = vi
      .fn()
      .mockResolvedValue({ [expectedHash]: translatedString });
    const loadDictionary = vi.fn().mockResolvedValue({ greeting: 'Bonjour' });
    const cache = createCache({
      loadTranslations,
      dictionary: { greeting: 'Hello' },
      loadDictionary,
    });

    const [translationsA, translationsB] = await Promise.all([
      cache.loadTranslations('fr'),
      cache.loadTranslations('fr'),
    ]);
    const [dictionaryA, dictionaryB] = await Promise.all([
      cache.loadDictionary('fr'),
      cache.loadDictionary('fr'),
    ]);

    expect(loadTranslations).toHaveBeenCalledTimes(1);
    expect(loadDictionary).toHaveBeenCalledTimes(1);
    expect(translationsA).toEqual(translationsB);
    expect(dictionaryA).toEqual(dictionaryB);
  });
});

describe('DictionaryManager contract: lookup API', () => {
  beforeEach(() => {
    initConfig();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetGTGlobals();
    vi.restoreAllMocks();
  });

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
});
