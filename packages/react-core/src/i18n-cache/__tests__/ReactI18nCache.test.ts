import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeI18nConfig } from 'gt-i18n/internal';
import type { LookupOptions } from 'gt-i18n/internal/types';
import { ReactI18nCache } from '../ReactI18nCache';
import { createResolveMissing } from '../createResolveMissing';

const message = 'Hello';
const options: LookupOptions = { $format: 'ICU' };
const rejectedKeyError = new Error(
  'Remote translation request failed: 401 Invalid API key'
);

type TestGlobal = typeof globalThis & {
  __generaltranslation?: unknown;
};

function resetGTGlobals() {
  Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
}

function createCache() {
  return new ReactI18nCache(
    {
      loadTranslations: vi.fn().mockResolvedValue({}),
    },
    {
      createResolveMissing,
    }
  );
}

describe('ReactI18nCache', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetGTGlobals();
    initializeI18nConfig({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
    });
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    resetGTGlobals();
    vi.restoreAllMocks();
  });

  it('does not resolve or emit misses without a resolver adapter', async () => {
    const cache = new ReactI18nCache({
      loadTranslations: vi.fn().mockResolvedValue({}),
    });
    const lookup = vi.spyOn(cache, 'lookupTranslationWithFallback');
    const listener = vi.fn();
    cache.subscribe(listener);

    await cache.resolveMissing({
      type: 'translation',
      locale: 'fr',
      message,
      options,
    });

    expect(lookup).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
  });

  it('emits the translation lookup after resolution', async () => {
    const cache = createCache();
    vi.spyOn(cache, 'lookupTranslationWithFallback').mockResolvedValue(
      'Bonjour'
    );
    const listener = vi.fn();
    const unsubscribe = cache.subscribe(listener);

    await cache.resolveMissing({
      type: 'translation',
      locale: 'fr',
      message,
      options,
    });

    expect(listener).toHaveBeenCalledWith({
      type: 'translation',
      locale: 'fr',
      message,
      options,
    });

    unsubscribe();
    await cache.resolveMissing({
      type: 'translation',
      locale: 'fr',
      message,
      options,
    });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('emits dictionary invalidations after entry and object resolution', async () => {
    const cache = createCache();
    vi.spyOn(cache, 'lookupDictionaryWithFallback').mockResolvedValue({
      entry: 'Bonjour',
      options: {},
    });
    vi.spyOn(cache, 'lookupDictionaryObjWithFallback').mockResolvedValue({
      title: 'Accueil',
    });
    const listener = vi.fn();
    cache.subscribe(listener);

    await cache.resolveMissing({
      type: 'dictionaryEntry',
      locale: 'fr',
      id: 'greeting',
    });
    await cache.resolveMissing({
      type: 'dictionaryObject',
      locale: 'fr',
      id: 'nav',
    });

    expect(listener).toHaveBeenNthCalledWith(1, {
      type: 'dictionaryEntry',
      locale: 'fr',
      id: 'greeting',
    });
    expect(listener).toHaveBeenNthCalledWith(2, {
      type: 'dictionaryObject',
      locale: 'fr',
      id: 'nav',
    });
  });

  it('logs a rejected resolution without emitting or rejecting', async () => {
    const cache = createCache();
    vi.spyOn(cache, 'lookupTranslationWithFallback').mockRejectedValue(
      rejectedKeyError
    );
    const listener = vi.fn();
    cache.subscribe(listener);

    await expect(
      cache.resolveMissing({
        type: 'translation',
        locale: 'fr',
        message,
        options,
      })
    ).resolves.toBeUndefined();

    expect(listener).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('401 Invalid API key')
    );
  });

  it('deduplicates identical resolution failures', async () => {
    const cache = createCache();
    vi.spyOn(cache, 'lookupTranslationWithFallback').mockRejectedValue(
      rejectedKeyError
    );

    await cache.resolveMissing({
      type: 'translation',
      locale: 'fr',
      message,
      options,
    });
    await cache.resolveMissing({
      type: 'translation',
      locale: 'fr',
      message: 'Goodbye',
      options,
    });

    expect(consoleError).toHaveBeenCalledTimes(1);
  });

  it('logs rejected dictionary resolutions without rejecting', async () => {
    const cache = createCache();
    vi.spyOn(cache, 'lookupDictionaryWithFallback').mockRejectedValue(
      rejectedKeyError
    );
    vi.spyOn(cache, 'lookupDictionaryObjWithFallback').mockRejectedValue(
      new Error('Dictionary object request failed')
    );

    await expect(
      cache.resolveMissing({
        type: 'dictionaryEntry',
        locale: 'fr',
        id: 'greeting',
      })
    ).resolves.toBeUndefined();
    await expect(
      cache.resolveMissing({
        type: 'dictionaryObject',
        locale: 'fr',
        id: 'nav',
      })
    ).resolves.toBeUndefined();

    expect(consoleError).toHaveBeenCalledTimes(2);
  });

  it('bounds the resolution failure dedupe set', async () => {
    const cache = createCache();
    const lookup = vi.spyOn(cache, 'lookupTranslationWithFallback');
    for (let index = 0; index <= 100; index++) {
      lookup.mockRejectedValueOnce(new Error(`failure ${index}`));
      await cache.resolveMissing({
        type: 'translation',
        locale: 'fr',
        message: `message ${index}`,
        options,
      });
    }
    expect(consoleError).toHaveBeenCalledTimes(101);

    lookup.mockRejectedValueOnce(new Error('failure 0'));
    await cache.resolveMissing({
      type: 'translation',
      locale: 'fr',
      message,
      options,
    });

    expect(consoleError).toHaveBeenCalledTimes(102);
  });

  it('deduplicates non-Error rejection reasons by value', async () => {
    const cache = createCache();
    const lookup = vi.spyOn(cache, 'lookupTranslationWithFallback');

    for (const [reason, lookupMessage] of [
      [{ code: 'A' }, 'm1'],
      [{ code: 'B' }, 'm2'],
      [null, 'm3'],
      [undefined, 'm4'],
      [{ code: 'A' }, 'm5'],
    ] as const) {
      lookup.mockRejectedValueOnce(reason);
      await cache.resolveMissing({
        type: 'translation',
        locale: 'fr',
        message: lookupMessage,
        options,
      });
    }

    expect(consoleError).toHaveBeenCalledTimes(4);
  });
});
