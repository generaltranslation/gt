import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getReactI18nCache,
  getTranslationsSnapshot,
} from '@generaltranslation/react-core/pure';
import { initializeGT } from '../initializeGT';

describe('initializeGT', () => {
  beforeEach(() => {
    Reflect.deleteProperty(globalThis, '__generaltranslation');
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, '__generaltranslation');
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('initializes the i18n config and cache for translation snapshots', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const loadTranslations = vi.fn(async () => ({
      greeting: 'Hola',
    }));

    initializeGT({
      defaultLocale: 'en',
      locales: ['en', 'es'],
      loadTranslations,
    });

    await expect(getTranslationsSnapshot('es')).resolves.toEqual({
      es: { greeting: 'Hola' },
    });
    expect(loadTranslations).toHaveBeenCalledWith('es');
  });

  it.each([{}, { cacheExpiryTime: 1000 }])(
    'keeps loaded and added translations for the life of the app with %o',
    async (expiry) => {
      vi.useFakeTimers();
      const loadTranslations = vi.fn(async () => ({ greeting: 'Hola' }));
      initializeGT({
        defaultLocale: 'en',
        locales: ['en', 'es'],
        ...expiry,
        loadTranslations,
      });
      await getTranslationsSnapshot('es');
      getReactI18nCache().updateTranslations({ es: { farewell: 'Adiós' } });

      // Longer than any translation cache expiry a server uses by default.
      vi.advanceTimersByTime(24 * 60 * 60_000);

      await expect(getTranslationsSnapshot('es')).resolves.toEqual({
        es: { greeting: 'Hola', farewell: 'Adiós' },
      });
      expect(loadTranslations).toHaveBeenCalledOnce();
      expect(getReactI18nCache().getCacheExpiryTime()).toBeNull();
    }
  );
});
