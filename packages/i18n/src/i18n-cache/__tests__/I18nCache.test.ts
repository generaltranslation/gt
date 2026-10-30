import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { I18nCache } from '../I18nCache';
import type { TranslationsCacheMissEvent } from '../I18nCache';
import { createTranslateManyFactory } from '../translations-manager/utils/createTranslateMany';
import { hashMessage } from '../../utils/hashMessage';
import { LookupOptions } from '../../translation-functions/types/options';
import { initializeI18nConfig } from '../../i18n-config/singleton-operations';
import type { CustomMapping } from '@generaltranslation/format';

// Mock createTranslateManyFactory to inject a controlled translateMany
const mockTranslateMany = vi.fn();
vi.mock('../translations-manager/utils/createTranslateMany', () => ({
  createTranslateManyFactory: vi.fn().mockReturnValue(() => mockTranslateMany),
}));

// Test data
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
    customMapping,
    ...cacheOverrides
  } = overrides;
  resetGTGlobals();
  initializeI18nConfig({
    defaultLocale: defaultLocale as string,
    locales: locales as string[],
    customMapping: customMapping as CustomMapping | undefined,
  });

  return new TestI18nCache({
    loadTranslations: vi
      .fn()
      .mockResolvedValue({ [expectedHash]: translatedString }),
    ...cacheOverrides,
  });
}

describe('I18nCache', () => {
  beforeEach(() => {
    resetGTGlobals();
    initializeI18nConfig({
      defaultLocale: 'en',
      locales: ['en', 'fr', 'es'],
    });
    vi.clearAllMocks();
    mockTranslateMany.mockReset();
  });

  afterEach(() => {
    resetGTGlobals();
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  // ===== NEW BEHAVIOR TESTS ===== //

  it('uses approved locale spelling for translation loader and cache keys', async () => {
    const loadTranslations = vi
      .fn()
      .mockResolvedValue({ [expectedHash]: translatedString });
    const cache = createCache({ locales: ['en', 'fr-fr'], loadTranslations });

    expect(await cache.loadTranslations('fr-FR')).toEqual({
      [expectedHash]: translatedString,
    });
    expect(await cache.loadTranslations('fr-fr')).toEqual({
      [expectedHash]: translatedString,
    });
    expect(loadTranslations).toHaveBeenCalledTimes(1);
    expect(loadTranslations.mock.calls[0][0]).toBe('fr-fr');
  });

  it('loads configured lowercase files for equivalent canonical requests', async () => {
    const loadTranslations = vi.fn(async (locale: string) => {
      if (locale !== 'en-gb') throw new Error(`No file for ${locale}`);
      return { [expectedHash]: translatedString };
    });
    const cache = createCache({
      defaultLocale: 'fr',
      locales: ['fr', 'en-gb'],
      customMapping: { 'en-gb': { code: 'en-GB' } },
      loadTranslations,
    });

    expect(await cache.loadTranslations('en-GB')).toEqual({
      [expectedHash]: translatedString,
    });
    expect(await cache.loadTranslations('en-gb')).toEqual({
      [expectedHash]: translatedString,
    });
    expect(loadTranslations).toHaveBeenCalledExactlyOnceWith('en-gb');
  });

  it('loadTranslations() returns Record<Hash, Translation>', async () => {
    const cache = createCache();

    const translations = await cache.loadTranslations('fr');

    expect(translations[expectedHash]).toBe(translatedString);
  });

  it('lookupTranslation() returns undefined before load, translation after', async () => {
    const cache = createCache();

    // Before loading
    const before = cache.lookupTranslation('fr', message, lookupOptions);
    expect(before).toBeUndefined();

    // Load translations
    await cache.loadTranslations('fr');

    // After loading
    const after = cache.lookupTranslation('fr', message, lookupOptions);
    expect(after).toBe(translatedString);
  });

  it.each([
    {
      name: 'expires',
      cacheExpiryTime: 100,
      advanceBy: 101,
      lookupAfter: undefined,
      reloaded: 'Salut {name} !',
      calls: 2,
    },
    {
      name: 'keeps',
      cacheExpiryTime: null,
      advanceBy: 60_001,
      lookupAfter: translatedString,
      reloaded: translatedString,
      calls: 1,
    },
  ])('$name locale caches according to cacheExpiryTime', async (testCase) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const loadTranslations = vi
      .fn()
      .mockResolvedValueOnce({ [expectedHash]: translatedString })
      .mockResolvedValueOnce({ [expectedHash]: 'Salut {name} !' });
    const cache = createCache({
      cacheExpiryTime: testCase.cacheExpiryTime,
      loadTranslations,
    });

    await cache.loadTranslations('fr');
    expect(cache.lookupTranslation('fr', message, lookupOptions)).toBe(
      translatedString
    );

    vi.advanceTimersByTime(testCase.advanceBy);
    expect(cache.lookupTranslation('fr', message, lookupOptions)).toBe(
      testCase.lookupAfter
    );

    const translations = await cache.loadTranslations('fr');
    expect(translations[expectedHash]).toBe(testCase.reloaded);
    expect(loadTranslations).toHaveBeenCalledTimes(testCase.calls);
  });

  it.each([
    {
      name: 'requested dialect locale',
      locale: 'en-GB',
      translationLocale: 'en-GB',
      translation: 'Hello there {name}!',
    },
    {
      name: 'custom alias locale',
      locale: 'brand-british',
      translationLocale: 'brand-british',
      translation: 'Hello mate {name}!',
      customMapping: {
        'brand-british': {
          code: 'en-GB',
          name: 'Brand British',
        },
      },
    },
    {
      name: 'canonical locale with custom alias',
      locale: 'en-GB',
      translationLocale: 'brand-british',
      translation: 'Hello mate {name}!',
      customMapping: {
        'brand-british': {
          code: 'en-GB',
          name: 'Brand British',
        },
      },
    },
  ])(
    'uses $name cache key when approved fallback is source-equivalent',
    async (testCase) => {
      const loadTranslations = vi
        .fn()
        .mockResolvedValue({ [expectedHash]: testCase.translation });
      const cache = createCache({
        defaultLocale: 'en-US',
        locales: ['en-US', 'en'],
        loadTranslations,
        ...(testCase.customMapping && {
          customMapping: testCase.customMapping,
        }),
      });

      const translations = await cache.loadTranslations(testCase.locale);

      expect(loadTranslations).toHaveBeenCalledTimes(1);
      expect(loadTranslations).toHaveBeenCalledWith(testCase.translationLocale);
      expect(translations[expectedHash]).toBe(testCase.translation);
      expect(
        cache.lookupTranslation(testCase.locale, message, lookupOptions)
      ).toBe(testCase.translation);
    }
  );

  it('lookupTranslationWithFallback() falls back to runtime translate on cache miss', async () => {
    const unknownMessage = 'Unknown message';
    const unknownOptions: LookupOptions = { $format: 'ICU' };
    const unknownHash = hashMessage(unknownMessage, unknownOptions);

    // loadTranslations returns translations that do NOT include unknownMessage
    const cache = createCache({
      runtimeTranslation: {
        timeout: 4321,
        metadata: {
          sourceLocale: 'en',
          projectId: 'project-id',
          publish: true,
        },
      },
    });

    // Mock translateMany to return a translation for the unknown message
    mockTranslateMany.mockResolvedValue({
      [unknownHash]: {
        success: true,
        translation: 'Message inconnu',
      },
    });

    const result = await cache.lookupTranslationWithFallback(
      'fr',
      unknownMessage,
      unknownOptions
    );

    expect(result).toBe('Message inconnu');
    expect(mockTranslateMany).toHaveBeenCalled();
    expect(createTranslateManyFactory).toHaveBeenCalledWith(
      expect.any(Function),
      4321,
      {
        sourceLocale: 'en',
        projectId: 'project-id',
        publish: true,
      }
    );
  });

  it('forwards the top-level model provider to runtime translations', () => {
    createCache({ modelProvider: 'anthropic' });

    expect(createTranslateManyFactory).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Number),
      { modelProvider: 'anthropic' }
    );
  });

  it('prefers runtime translation metadata over the top-level model provider', () => {
    createCache({
      modelProvider: 'anthropic',
      runtimeTranslation: {
        metadata: { modelProvider: 'openai' },
      },
    });

    expect(createTranslateManyFactory).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Number),
      { modelProvider: 'openai' }
    );
  });

  it('shares configured cache entries across alias and canonical requests', async () => {
    const loadTranslations = vi
      .fn()
      .mockResolvedValue({ [expectedHash]: translatedString });
    const cache = createCache({
      loadTranslations,
      locales: ['en', 'brand-french', 'es'],
      customMapping: {
        'brand-french': {
          code: 'fr',
          name: 'Brand French',
        },
      },
    });

    await cache.loadTranslations('brand-french');

    expect(loadTranslations).toHaveBeenCalledTimes(1);
    expect(loadTranslations).toHaveBeenCalledWith('brand-french');
    await cache.loadTranslations('fr');
    expect(
      cache.lookupTranslation('brand-french', message, lookupOptions)
    ).toBe(translatedString);
    expect(loadTranslations).toHaveBeenCalledTimes(1);
  });

  it('does not need current locale state for explicit locale operations', async () => {
    const loadTranslations = vi
      .fn()
      .mockResolvedValue({ [expectedHash]: translatedString });
    const cache = createCache({
      loadTranslations,
    });

    await cache.loadTranslations('fr');

    expect(loadTranslations).toHaveBeenCalledWith('fr');
    expect(cache.lookupTranslation('fr', message, lookupOptions)).toBe(
      translatedString
    );
    await expect(
      cache.lookupTranslationWithFallback('fr', message, lookupOptions)
    ).resolves.toBe(translatedString);
    await expect(cache.getLookupTranslation('fr')).resolves.toEqual(
      expect.any(Function)
    );
  });

  it('emits translations-cache-miss when a runtime translation resolves', async () => {
    const unknownMessage = 'Unknown message';
    const unknownOptions: LookupOptions = { $format: 'ICU' };
    const unknownHash = hashMessage(unknownMessage, unknownOptions);

    const cache = createCache({ runtimeTranslation: {} });
    const onTranslationsCacheMiss = vi.fn();
    cache.setTranslationsCacheMissListener(onTranslationsCacheMiss);

    mockTranslateMany.mockResolvedValue({
      [unknownHash]: {
        success: true,
        translation: 'Message inconnu',
      },
    });

    await cache.lookupTranslationWithFallback(
      'fr',
      unknownMessage,
      unknownOptions
    );

    expect(onTranslationsCacheMiss).toHaveBeenCalledWith({
      locale: 'fr',
      hash: unknownHash,
      translation: 'Message inconnu',
    });
  });
});
