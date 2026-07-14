/**
 * Contract tests for I18nCache config-time behavior: constructor validation,
 * translation-loader routing, and runtime-translation plumbing.
 *
 * These tests exercise I18nCache ONLY through its public boundary so the
 * validation/ directory and translations-loaders/ internals can be
 * restructured or inlined without breaking behavior. Do not import or mock
 * i18n-cache internals here; the only stubbed boundaries are global fetch,
 * console, env, and GTRuntime.prototype.translateMany.
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
import { I18nCache } from '../I18nCache';
import { initializeI18nConfig } from '../../i18n-config/singleton-operations';
import { hashMessage } from '../../utils/hashMessage';
import type { LookupOptions } from '../../translation-functions/types/options';

type TestGlobal = typeof globalThis & {
  __generaltranslation?: unknown;
};

function resetGTGlobals() {
  Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
}

function initConfig(overrides: Record<string, unknown> = {}) {
  resetGTGlobals();
  initializeI18nConfig({
    defaultLocale: 'en',
    locales: ['en', 'fr', 'es'],
    ...overrides,
  });
}

/** Console calls whose first argument contains the given substring */
function callsContaining(spy: MockInstance, substring: string) {
  return spy.mock.calls.filter((call) => String(call[0]).includes(substring));
}

function mockFetchResponse(payload: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(payload),
  });
}

/** translateMany stub that succeeds for every requested hash */
function succeedTranslateMany(
  translate: (hash: string, source: unknown) => string
) {
  return vi
    .spyOn(GTRuntime.prototype, 'translateMany')
    .mockImplementation(async (sources) =>
      Object.fromEntries(
        Object.entries(sources as Record<string, { source: unknown }>).map(
          ([hash, entry]) => [
            hash,
            { success: true, translation: translate(hash, entry.source) },
          ]
        )
      )
    ) as MockInstance;
}

describe('I18nCache config contract', () => {
  let warnSpy: MockInstance;
  let errorSpy: MockInstance;

  beforeEach(() => {
    initConfig();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    resetGTGlobals();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  // ===== Constructor validation ===== //

  it('throws and logs an error when loadDictionary is provided without a source dictionary', () => {
    expect(
      () =>
        new I18nCache({
          loadDictionary: async () => ({}),
        })
    ).toThrow('Validation errors occurred');

    const errors = callsContaining(errorSpy, 'I18nCache:');
    expect(errors.length).toBe(1);
    expect(String(errors[0][0])).toContain(
      'loadDictionary needs a source dictionary'
    );
  });

  it('accepts loadDictionary when a source dictionary is provided', () => {
    expect(
      () =>
        new I18nCache({
          dictionary: { greeting: 'Hello' },
          loadDictionary: async () => ({}),
        })
    ).not.toThrow();
    expect(callsContaining(errorSpy, 'I18nCache:').length).toBe(0);
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

  it('emits no validation warnings or errors for a standard GT config', () => {
    new I18nCache({
      projectId: 'test-project',
      apiKey: 'test-api-key',
      loadTranslations: async () => ({}),
    });

    expect(callsContaining(warnSpy, 'I18nCache:').length).toBe(0);
    expect(callsContaining(errorSpy, 'I18nCache:').length).toBe(0);
  });

  // ===== Translation loader routing ===== //

  it('uses a custom loadTranslations loader and never fetches', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
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

  it('fetches from the default GT cache URL when projectId is set', async () => {
    const payload = { hash1: 'Bonjour le monde !' };
    const fetchSpy = mockFetchResponse(payload);
    vi.stubGlobal('fetch', fetchSpy);
    const cache = new I18nCache({ projectId: 'test-project' });

    const translations = await cache.loadTranslations('fr');

    expect(fetchSpy).toHaveBeenCalledWith(`${defaultCacheUrl}/test-project/fr`);
    expect(translations).toEqual(payload);
  });

  it('includes the _versionId segment and _branchId query in the remote URL', async () => {
    const fetchSpy = mockFetchResponse({});
    vi.stubGlobal('fetch', fetchSpy);
    const cache = new I18nCache({
      projectId: 'test-project',
      _versionId: 'v123',
      _branchId: 'b9',
    });

    await cache.loadTranslations('fr');

    expect(fetchSpy).toHaveBeenCalledWith(
      `${defaultCacheUrl}/test-project/fr/v123?branchId=b9`
    );
  });

  it('fetches from a custom cacheUrl', async () => {
    const fetchSpy = mockFetchResponse({});
    vi.stubGlobal('fetch', fetchSpy);
    const cache = new I18nCache({
      projectId: 'test-project',
      cacheUrl: 'https://cache.example.com',
    });

    await cache.loadTranslations('fr');

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://cache.example.com/test-project/fr'
    );
  });

  it('warns once and returns {} when a custom cacheUrl has no projectId', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const cache = new I18nCache({ cacheUrl: 'https://cache.example.com' });

    // Two different locales force two loader invocations; the warning fires once
    expect(await cache.loadTranslations('fr')).toEqual({});
    expect(await cache.loadTranslations('es')).toEqual({});

    const warnings = callsContaining(warnSpy, 'projectId');
    expect(warnings.length).toBe(1);
    expect(String(warnings[0][0])).toContain(
      'Loading translations from a remote store needs a projectId'
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns {} silently when cacheUrl is null', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const cache = new I18nCache({ cacheUrl: null });

    expect(await cache.loadTranslations('fr')).toEqual({});

    expect(warnSpy).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('warns once and returns {} when no translation loader is configured', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const cache = new I18nCache({});

    expect(await cache.loadTranslations('fr')).toEqual({});
    expect(await cache.loadTranslations('es')).toEqual({});

    const warnings = callsContaining(warnSpy, 'No translation loader found');
    expect(warnings.length).toBe(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('logs and returns {} when the remote fetch fails', async () => {
    // current behavior: vitest runs as production for getRuntimeEnvironment(),
    // so load errors are logged and swallowed instead of thrown
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 404 })
    );
    const cache = new I18nCache({ projectId: 'test-project' });

    expect(await cache.loadTranslations('fr')).toEqual({});

    const errors = callsContaining(errorSpy, 'Failed to load translations');
    expect(errors.length).toBe(1);
  });

  // ===== Runtime translation plumbing ===== //

  const message = 'Hello {name}!';
  const lookupOptions: LookupOptions = {
    $format: 'ICU',
    $context: 'greeting',
    $id: 'greeting.hello',
    $maxChars: 40,
    $requiresReview: true,
  };

  it('passes runtimeTranslation timeout and metadata through to GTRuntime.translateMany', async () => {
    const translateManySpy = succeedTranslateMany(() => 'Bonjour {name} !');
    const cache = new I18nCache({
      loadTranslations: async () => ({}),
      runtimeTranslation: {
        timeout: 5000,
        metadata: { sourceLocale: 'en', modelProvider: 'test-provider' },
      },
    });

    const translation = await cache.lookupTranslationWithFallback(
      'fr',
      message,
      lookupOptions
    );

    expect(translation).toBe('Bonjour {name} !');
    expect(translateManySpy).toHaveBeenCalledTimes(1);
    const [sources, options, timeout] = translateManySpy.mock.calls[0];
    const expectedHash = hashMessage(message, lookupOptions);
    expect(sources).toEqual({
      [expectedHash]: {
        source: message,
        metadata: {
          hash: expectedHash,
          context: 'greeting',
          id: 'greeting.hello',
          maxChars: 40,
          requiresReview: true,
          dataFormat: 'ICU',
        },
      },
    });
    expect(options).toEqual({
      sourceLocale: 'en',
      modelProvider: 'test-provider',
      targetLocale: 'fr',
    });
    expect(timeout).toBe(5000);
  });

  it('defaults the runtime translation timeout to 12 seconds', async () => {
    const translateManySpy = succeedTranslateMany(() => 'Bonjour !');
    const cache = new I18nCache({ loadTranslations: async () => ({}) });

    await cache.lookupTranslationWithFallback('fr', 'Hello!', {
      $format: 'ICU',
    });

    expect(translateManySpy).toHaveBeenCalledTimes(1);
    const [, options, timeout] = translateManySpy.mock.calls[0];
    expect(options).toEqual({ targetLocale: 'fr' });
    expect(timeout).toBe(12_000);
  });

  it('resolves the requested locale before calling translateMany', async () => {
    const translateManySpy = succeedTranslateMany(() => 'Bonjour !');
    const cache = new I18nCache({ loadTranslations: async () => ({}) });

    await cache.lookupTranslationWithFallback('fr-FR', 'Hello!', {
      $format: 'ICU',
    });

    expect(translateManySpy).toHaveBeenCalledTimes(1);
    const [, options] = translateManySpy.mock.calls[0];
    expect((options as { targetLocale: string }).targetLocale).toBe('fr');
  });

  it('batches concurrent cache misses into a single translateMany call', async () => {
    const translateManySpy = succeedTranslateMany((hash) => `t-${hash}`);
    const cache = new I18nCache({
      loadTranslations: async () => ({}),
      batchConfig: { maxBatchSize: 2 },
    });

    const [first, second] = await Promise.all([
      cache.lookupTranslationWithFallback('fr', 'One', { $format: 'ICU' }),
      cache.lookupTranslationWithFallback('fr', 'Two', { $format: 'ICU' }),
    ]);

    expect(translateManySpy).toHaveBeenCalledTimes(1);
    const [sources] = translateManySpy.mock.calls[0];
    expect(Object.keys(sources as object).length).toBe(2);
    expect(first).toBe(`t-${hashMessage('One', { $format: 'ICU' })}`);
    expect(second).toBe(`t-${hashMessage('Two', { $format: 'ICU' })}`);
  });

  it('splits misses that exceed maxBatchSize into separate calls', async () => {
    const translateManySpy = succeedTranslateMany((hash) => `t-${hash}`);
    const cache = new I18nCache({
      loadTranslations: async () => ({}),
      batchConfig: { maxBatchSize: 2 },
    });

    await Promise.all([
      cache.lookupTranslationWithFallback('fr', 'One', { $format: 'ICU' }),
      cache.lookupTranslationWithFallback('fr', 'Two', { $format: 'ICU' }),
      cache.lookupTranslationWithFallback('fr', 'Three', { $format: 'ICU' }),
    ]);

    expect(translateManySpy).toHaveBeenCalledTimes(2);
    expect(
      Object.keys(translateManySpy.mock.calls[0][0] as object).length
    ).toBe(2);
    expect(
      Object.keys(translateManySpy.mock.calls[1][0] as object).length
    ).toBe(1);
  });

  // ===== Dictionary loader plumbing ===== //

  it('loads the dictionary lazily and deduplicates concurrent loads', async () => {
    const loadDictionary = vi.fn().mockResolvedValue({ greeting: 'Bonjour' });
    const cache = new I18nCache({
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
