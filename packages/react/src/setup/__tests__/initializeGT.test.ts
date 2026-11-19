import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getReactI18nCache, t } from '@generaltranslation/react-core/pure';
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
