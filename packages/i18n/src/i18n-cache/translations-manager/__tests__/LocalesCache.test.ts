import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LocalesCache } from '../LocalesCache';
import { DEFAULT_CACHE_EXPIRY_TIME } from '../utils/constants';
import type { Dictionary, DictionaryLoader } from '../DictionaryCache';
import type { Hash } from '../TranslationsCache';
import type { CreateTranslateMany } from '../utils/createTranslateMany';
import type { LocalesTranslationsCacheMissCallback } from '../LocalesCache';
import type { SafeTranslationsLoader } from '../translations-loaders/types';
import { initializeI18nConfig } from '../../../i18n-config/singleton-operations';

describe('LocalesCache', () => {
  let mockLoadTranslations: ReturnType<typeof vi.fn>;
  let mockLoadDictionary: ReturnType<typeof vi.fn>;
  let mockCreateTranslateMany: ReturnType<typeof vi.fn>;
  let mockRuntimeTranslate: ReturnType<typeof vi.fn>;
  const frTranslations: Record<Hash, string> = {
    hash1: 'Bonjour',
    hash2: 'Au revoir',
  };
  const enDictionary: Dictionary = {
    greeting: 'Hello',
    cta: ['Click me', { $context: 'button', $maxChars: 12 }],
  };
  const frDictionary: Dictionary = {
    greeting: 'Bonjour',
    cta: ['Cliquez', { $context: 'button' }],
    user: {
      name: 'Nom',
    },
  };

  beforeEach(() => {
    vi.useFakeTimers();
    initializeI18nConfig({ defaultLocale: 'en', locales: ['en', 'fr'] });
    mockLoadTranslations = vi.fn().mockResolvedValue(frTranslations);
    mockLoadDictionary = vi.fn().mockResolvedValue(frDictionary);
    mockCreateTranslateMany = vi.fn().mockReturnValue(vi.fn());
    mockRuntimeTranslate = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function createCache(opts?: {
    ttl?: number | null;
    onTranslationsCacheMiss?: LocalesTranslationsCacheMissCallback<string>;
  }) {
    return new LocalesCache<string>({
      dictionary: enDictionary,
      loadTranslations: mockLoadTranslations as SafeTranslationsLoader<string>,
      loadDictionary: mockLoadDictionary as DictionaryLoader,
      createTranslateMany: mockCreateTranslateMany as CreateTranslateMany,
      translateDictionaryEntry: mockRuntimeTranslate,
      ...(opts?.onTranslationsCacheMiss
        ? { onTranslationsCacheMiss: opts.onTranslationsCacheMiss }
        : {}),
      ...(opts?.ttl !== undefined ? { ttl: opts.ttl } : {}),
    });
  }

  describe('translations', () => {
    it('getTranslations() returns undefined when locale is not loaded', () => {
      const cache = createCache();

      expect(cache.getTranslations('fr')).toBeUndefined();
    });

    it('getOrLoadTranslations() loads and returns a TranslationsCache', async () => {
      const cache = createCache();
      const translationsCache = await cache.getOrLoadTranslations('fr');

      expect(mockLoadTranslations).toHaveBeenCalledWith('fr');
      expect(translationsCache.getInternalCache()).toEqual(frTranslations);
    });

    it('getOrLoadTranslations() deduplicates concurrent loads', async () => {
      const cache = createCache();

      const firstCache = cache.getOrLoadTranslations('fr');
      const secondCache = cache.getOrLoadTranslations('fr');
      const [firstResult, secondResult] = await Promise.all([
        firstCache,
        secondCache,
      ]);

      expect(mockLoadTranslations).toHaveBeenCalledTimes(1);
      expect(firstResult).toBe(secondResult);
    });

    it('getTranslations() returns cache after getOrLoadTranslations() populates it', async () => {
      const cache = createCache();

      expect(cache.getTranslations('fr')).toBeUndefined();
      await cache.getOrLoadTranslations('fr');

      expect(cache.getTranslations('fr')?.getInternalCache()).toEqual(
        frTranslations
      );
    });

    it('getTranslations() returns undefined after default TTL expires', async () => {
      const cache = createCache();

      await cache.getOrLoadTranslations('fr');
      expect(cache.getTranslations('fr')).toBeDefined();
      vi.advanceTimersByTime(DEFAULT_CACHE_EXPIRY_TIME + 1);

      expect(cache.getTranslations('fr')).toBeUndefined();
    });

    it('ttl: null means translation cache never expires', async () => {
      const cache = createCache({ ttl: null });

      await cache.getOrLoadTranslations('fr');
      expect(cache.getTranslations('fr')).toBeDefined();
      vi.advanceTimersByTime(999_999_999);

      expect(cache.getTranslations('fr')).toBeDefined();
    });

    it('custom translation TTL is respected', async () => {
      const cache = createCache({ ttl: 5000 });

      await cache.getOrLoadTranslations('fr');
      vi.advanceTimersByTime(4999);
      expect(cache.getTranslations('fr')).toBeDefined();
      vi.advanceTimersByTime(2);

      expect(cache.getTranslations('fr')).toBeUndefined();
    });

    it('starts translation TTL after translations finish loading', async () => {
      const cache = createCache({ ttl: 5000 });
      let resolveTranslations!: (translations: Record<Hash, string>) => void;
      mockLoadTranslations.mockReturnValue(
        new Promise((resolve) => {
          resolveTranslations = resolve;
        })
      );

      const loadPromise = cache.getOrLoadTranslations('fr');
      vi.advanceTimersByTime(4000);
      resolveTranslations(frTranslations);
      await loadPromise;
      vi.advanceTimersByTime(4999);
      expect(cache.getTranslations('fr')).toBeDefined();
      vi.advanceTimersByTime(2);

      expect(cache.getTranslations('fr')).toBeUndefined();
    });
  });

  describe('dictionaries', () => {
    it('getDictionary() returns the default locale dictionary cache without loading', () => {
      const cache = createCache();
      const dictionaryCache = cache.getDictionary('en');

      expect(dictionaryCache).toBeDefined();
      expect(dictionaryCache!.getInternalCache()).toEqual(enDictionary);
      expect(mockLoadDictionary).not.toHaveBeenCalled();
    });

    it('getDictionary() returns undefined when non-default locale is not loaded', () => {
      const cache = createCache();

      expect(cache.getDictionary('fr')).toBeUndefined();
    });

    it('getOrLoadDictionary() loads and returns a DictionaryCache', async () => {
      const cache = createCache();
      const dictionaryCache = await cache.getOrLoadDictionary('fr');

      expect(mockLoadDictionary).toHaveBeenCalledWith('fr');
      expect(dictionaryCache.getInternalCache()).toEqual(frDictionary);
    });

    it('getOrLoadDictionary() deduplicates concurrent loads', async () => {
      const cache = createCache();

      const firstCache = cache.getOrLoadDictionary('fr');
      const secondCache = cache.getOrLoadDictionary('fr');
      const [firstResult, secondResult] = await Promise.all([
        firstCache,
        secondCache,
      ]);

      expect(mockLoadDictionary).toHaveBeenCalledTimes(1);
      expect(firstResult).toBe(secondResult);
    });

    it('getDictionary() returns cache after getOrLoadDictionary() populates it', async () => {
      const cache = createCache();

      expect(cache.getDictionary('fr')).toBeUndefined();
      await cache.getOrLoadDictionary('fr');

      expect(cache.getDictionary('fr')?.getInternalCache()).toEqual(
        frDictionary
      );
    });

    it('getDictionary() returns undefined after default TTL expires', async () => {
      const cache = createCache();

      await cache.getOrLoadDictionary('fr');
      expect(cache.getDictionary('fr')).toBeDefined();
      vi.advanceTimersByTime(DEFAULT_CACHE_EXPIRY_TIME + 1);

      expect(cache.getDictionary('fr')).toBeUndefined();
    });

    it('ttl: null means dictionary cache never expires', async () => {
      const cache = createCache({ ttl: null });

      await cache.getOrLoadDictionary('fr');
      expect(cache.getDictionary('fr')).toBeDefined();
      vi.advanceTimersByTime(999_999_999);

      expect(cache.getDictionary('fr')).toBeDefined();
    });

    it('getOrLoadDictionary() returns a DictionaryCache with entry metadata', async () => {
      const cache = createCache();
      const dictionaryCache = await cache.getOrLoadDictionary('fr');

      expect(dictionaryCache.getEntry('cta')).toEqual({
        entry: 'Cliquez',
        options: { $context: 'button' },
      });
    });

    it('default locale dictionary never expires', () => {
      const cache = createCache();

      vi.advanceTimersByTime(999_999_999);

      expect(cache.getDictionary('en')).toBeDefined();
    });

    it('updateDictionaries() updates locale dictionary caches', async () => {
      const cache = createCache();
      await cache.getOrLoadDictionary('fr');

      cache.updateDictionaries({
        en: {
          greeting: 'Hi',
          navigation: {
            home: 'Home',
          },
        },
        fr: {
          greeting: 'Salut',
          user: {
            title: 'Titre',
          },
          navigation: {
            home: 'Accueil',
          },
        },
      });

      expect(cache.getDictionary('en')?.getInternalCache()).toEqual({
        greeting: 'Hi',
        navigation: {
          home: 'Home',
        },
        cta: ['Click me', { $context: 'button', $maxChars: 12 }],
      });
      expect(cache.getDictionary('en')?.getEntry('cta')).toEqual({
        entry: 'Click me',
        options: { $context: 'button', $maxChars: 12 },
      });
      expect(cache.getDictionary('fr')?.getInternalCache()).toEqual({
        greeting: 'Salut',
        cta: ['Cliquez', { $context: 'button' }],
        user: {
          name: 'Nom',
          title: 'Titre',
        },
        navigation: {
          home: 'Accueil',
        },
      });
      expect(mockLoadDictionary).toHaveBeenCalledTimes(1);
    });
  });
});
