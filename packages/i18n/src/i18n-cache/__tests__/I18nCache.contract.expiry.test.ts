import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GTRuntime } from 'generaltranslation/runtime';
import { I18nCache } from '../I18nCache';
import { initializeI18nConfig } from '../../i18n-config/singleton-operations';
import { hashMessage } from '../../utils/hashMessage';
import type { LookupOptions } from '../../translation-functions/types/options';

const runtimePrototype = GTRuntime.prototype;

/**
 * Contract tests for I18nCache locale-cache expiry semantics.
 *
 * These tests lock in the observable TTL behavior of the PUBLIC I18nCache API
 * so the internal cache layers can be restructured safely. They intentionally
 * import nothing from translations-manager/ and mock no internal modules.
 */

const message = 'Hello {name}!';
const lookupOptions: LookupOptions = {
  $format: 'ICU',
  $context: 'greeting',
};
const expectedHash = hashMessage(message, lookupOptions);
const translatedString = 'Bonjour {name} !';

// Characterized default: locale caches expire after 60 seconds.
const DEFAULT_TTL = 60_000;

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

describe('I18nCache expiry contract', () => {
  beforeEach(() => {
    resetGTGlobals();
    initializeI18nConfig({
      defaultLocale: 'en',
      locales: ['en', 'fr', 'es'],
    });
  });

  afterEach(() => {
    resetGTGlobals();
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('expires translations after the default TTL and reloads on demand', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const loadTranslations = vi
      .fn()
      .mockResolvedValueOnce({ [expectedHash]: translatedString })
      .mockResolvedValueOnce({ [expectedHash]: 'Salut {name} !' });
    const cache = createCache({ loadTranslations });

    await cache.loadTranslations('fr');
    expect(cache.lookupTranslation('fr', message, lookupOptions)).toBe(
      translatedString
    );

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

  it('starts the TTL when the load resolves, not when it starts', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    let resolveTranslations!: (translations: Record<string, string>) => void;
    const loadTranslations = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        resolveTranslations = resolve;
      })
    );
    const cache = createCache({
      cacheExpiryTime: 5000,
      loadTranslations,
    });

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

  it('deduplicates concurrent runtime-translation misses for the same message', async () => {
    const unknownMessage = 'Unknown message';
    const unknownOptions: LookupOptions = { $format: 'ICU' };
    const unknownHash = hashMessage(unknownMessage, unknownOptions);
    resetGTGlobals();
    initializeI18nConfig({
      defaultLocale: 'en',
      locales: ['en', 'fr', 'es'],
      projectId: 'test-project',
      apiKey: 'test-api-key',
    });
    const translateManySpy = vi
      .spyOn(runtimePrototype, 'translateMany')
      .mockResolvedValue({
        [unknownHash]: {
          success: true,
          translation: 'Message inconnu',
        },
      } as Awaited<ReturnType<GTRuntime['translateMany']>>);
    const cache = createCache({
      loadTranslations: vi.fn().mockResolvedValue({}),
      runtimeTranslation: {},
    });

    const [first, second] = await Promise.all([
      cache.lookupTranslationWithFallback('fr', unknownMessage, unknownOptions),
      cache.lookupTranslationWithFallback('fr', unknownMessage, unknownOptions),
    ]);

    expect(first).toBe('Message inconnu');
    expect(second).toBe('Message inconnu');
    expect(translateManySpy).toHaveBeenCalledTimes(1);
    const [sources] = translateManySpy.mock.calls[0];
    expect(Object.keys(sources)).toEqual([unknownHash]);
  });
});
