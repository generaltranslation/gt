import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getReactI18nCache,
  getTranslationsSnapshot,
  t,
  updateGlobalTranslationsSnapshot,
} from '@generaltranslation/react-core/pure';
import { hashSource } from 'generaltranslation/id';
import { createLookupOptions, hashContent } from 'gt-i18n/internal';
import { initializeGTSPA } from '../initializeGTSPA';
import { initializeGTSRA } from '../initializeGTSRA';
import { initializeGTSRAClient } from '../initializeGTSRAClient';

const config = { defaultLocale: 'en', locales: ['en', 'fr'] };
const options = createLookupOptions('fr', {}, 'ICU');
const helloHash = hashContent('Hello', options);
const goodbyeHash = hashContent('Goodbye', options);
// The hash a t template looks its message up by
const treeHash = (source: string) =>
  hashSource({ source, dataFormat: 'MESSAGE_TREE' });
// Longer than any translation cache expiry a server uses by default.
const A_DAY = 24 * 60 * 60_000;

const createLoader = () => vi.fn(async () => ({ [helloHash]: 'Bonjour' }));

function lookup(source: string) {
  return getReactI18nCache().lookupTranslation('fr', source, options);
}

describe('translation cache expiry', () => {
  beforeEach(() => {
    Reflect.deleteProperty(globalThis, '__generaltranslation');
    vi.useFakeTimers();
    vi.stubGlobal('navigator', { languages: ['fr'] });
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, '__generaltranslation');
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it.each([{}, { cacheExpiryTime: 1000 }])(
    'initializeGTSPA() keeps loaded and registered translations with %o',
    async (expiry) => {
      const loadTranslations = vi.fn(async () => ({
        [treeHash('Hello')]: 'Bonjour',
      }));
      await initializeGTSPA({ ...config, ...expiry, loadTranslations });
      const cache = getReactI18nCache();
      cache.updateTranslations({ fr: { [treeHash('Goodbye')]: 'Au revoir' } });

      vi.advanceTimersByTime(A_DAY);

      expect(t`Hello`).toBe('Bonjour');
      expect(t`Goodbye`).toBe('Au revoir');
      await expect(cache.loadTranslations('fr')).resolves.toEqual({
        [treeHash('Hello')]: 'Bonjour',
        [treeHash('Goodbye')]: 'Au revoir',
      });
      expect(loadTranslations).toHaveBeenCalledOnce();
      expect(cache.getCacheExpiryTime()).toBeNull();
    }
  );

  it.each([{}, { cacheExpiryTime: 1000 }])(
    'the browser initializeGT() keeps loaded and hydrated translations with %o',
    async (expiry) => {
      const loadTranslations = createLoader();
      initializeGTSRAClient({ ...config, ...expiry, loadTranslations });
      const cache = getReactI18nCache();
      await cache.loadTranslations('fr');
      cache.updateTranslations({ fr: { [goodbyeHash]: 'Au revoir' } });

      vi.advanceTimersByTime(A_DAY);

      expect(lookup('Hello')).toBe('Bonjour');
      expect(lookup('Goodbye')).toBe('Au revoir');
      await cache.loadTranslations('fr');
      expect(loadTranslations).toHaveBeenCalledOnce();
      expect(cache.getCacheExpiryTime()).toBeNull();
    }
  );

  it('the server initializeGT() still expires a locale and loads it again', async () => {
    const loadTranslations = createLoader();
    initializeGTSRA({ ...config, loadTranslations });
    const cache = getReactI18nCache();
    await cache.loadTranslations('fr');
    cache.updateTranslations({ fr: { [goodbyeHash]: 'Au revoir' } });
    expect(lookup('Hello')).toBe('Bonjour');

    vi.advanceTimersByTime(A_DAY);

    expect(lookup('Hello')).toBeUndefined();
    await expect(cache.loadTranslations('fr')).resolves.toEqual({
      [helloHash]: 'Bonjour',
    });
    expect(loadTranslations).toHaveBeenCalledTimes(2);
  });

  it('the server initializeGT() uses the cacheExpiryTime it is given', async () => {
    initializeGTSRA({ ...config, cacheExpiryTime: 1000 });

    expect(getReactI18nCache().getCacheExpiryTime()).toBe(1000);
  });
});

describe('getTranslationsSnapshot() in a production browser', () => {
  const browserConfig = { defaultLocale: 'en', locales: ['en', 'fr', 'es'] };
  const translations = { fr: { [treeHash('Hello')]: 'Bonjour' } };
  const loadTranslations = vi.fn(async (locale: string) =>
    locale === 'fr' ? translations.fr : { [treeHash('Hello')]: 'Hola' }
  );

  beforeEach(() => {
    Reflect.deleteProperty(globalThis, '__generaltranslation');
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubGlobal('navigator', { languages: ['fr'] });
    loadTranslations.mockClear();
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, '__generaltranslation');
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('loads a locale for the browser initializeGT(), which creates no cache', async () => {
    initializeGTSRAClient({ ...browserConfig, loadTranslations });

    await expect(getTranslationsSnapshot('fr')).resolves.toEqual(translations);
    expect(() => getReactI18nCache()).toThrow();
  });

  it('copies the loaded locale and loads others after initializeGTSPA()', async () => {
    await initializeGTSPA({ ...browserConfig, loadTranslations });

    const snapshot = await getTranslationsSnapshot('fr');
    snapshot.fr[treeHash('Hello')] = 'Salut';
    updateGlobalTranslationsSnapshot({
      fr: { [treeHash('Goodbye')]: 'Au revoir' },
    });

    await expect(getTranslationsSnapshot('fr')).resolves.toEqual({
      fr: {
        [treeHash('Hello')]: 'Bonjour',
        [treeHash('Goodbye')]: 'Au revoir',
      },
    });
    expect(translations.fr).toEqual({ [treeHash('Hello')]: 'Bonjour' });
    await expect(getTranslationsSnapshot('es')).resolves.toEqual({
      es: { [treeHash('Hello')]: 'Hola' },
    });
    expect(loadTranslations.mock.calls).toEqual([['fr'], ['es']]);
  });
});
