import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SnapshotStore } from 'gt-i18n/internal/snapshot-store';
import { HydratedI18nCache } from '../HydratedI18nCache';
import { initializeI18nConfig } from '../../setup/i18nConfig';

type TestGlobal = typeof globalThis & {
  __generaltranslation?: unknown;
};

describe('HydratedI18nCache', () => {
  beforeEach(() => {
    Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
    initializeI18nConfig(
      {
        defaultLocale: 'en',
        locales: ['en', 'fr'],
      },
      'server-render'
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('preserves synchronous cache lookups over hydrated snapshots', () => {
    const snapshots = new SnapshotStore();
    const cache = new HydratedI18nCache({}, snapshots);
    cache.updateTranslations({ fr: { greeting: 'Bonjour' } });

    expect(
      cache.lookupTranslation('fr', 'Hello', {
        $_hash: 'greeting',
        $format: 'ICU',
      })
    ).toBe('Bonjour');
  });

  it('preserves legacy loading methods without constructing the full cache', async () => {
    const loadTranslations = vi.fn(async () => ({ greeting: 'Bonjour' }));
    const cache = new HydratedI18nCache(
      { cacheUrl: null, loadTranslations },
      new SnapshotStore()
    );

    await expect(cache.loadTranslations('fr')).resolves.toEqual({
      greeting: 'Bonjour',
    });
    expect(loadTranslations).toHaveBeenCalledWith('fr');
    expect(
      cache.lookupTranslation('fr', 'Hello', {
        $_hash: 'greeting',
        $format: 'ICU',
      })
    ).toBe('Bonjour');
  });

  it('deduplicates concurrent translation and dictionary loads by locale', async () => {
    const loadTranslations = vi.fn(async () => ({ greeting: 'Bonjour' }));
    const loadDictionary = vi.fn(async () => ({ greeting: 'Bonjour' }));
    const cache = new HydratedI18nCache(
      { cacheUrl: null, loadTranslations, loadDictionary },
      new SnapshotStore({ greeting: 'Hello' })
    );

    await Promise.all([
      cache.loadTranslations('fr'),
      cache.loadTranslations('fr'),
      cache.loadDictionary('fr'),
      cache.loadDictionary('fr'),
    ]);

    expect(loadTranslations).toHaveBeenCalledTimes(1);
    expect(loadDictionary).toHaveBeenCalledTimes(1);
  });

  it('preserves missing source dictionary errors in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const cache = new HydratedI18nCache(
      { cacheUrl: null },
      new SnapshotStore({ greeting: 'Hello' })
    );

    await expect(
      cache.lookupDictionaryWithFallback('fr', 'missing')
    ).rejects.toMatchObject({ name: 'DictionarySourceNotFoundError' });
    await expect(
      cache.lookupDictionaryObjWithFallback('fr', 'missing')
    ).rejects.toMatchObject({ name: 'DictionarySourceNotFoundError' });
  });

  it('preserves production soft failures for invalid locales', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const cache = new HydratedI18nCache({}, new SnapshotStore());

    await expect(cache.loadTranslations('not a locale')).resolves.toEqual({});
    expect(
      cache.lookupTranslation('not a locale', 'Hello', {
        $format: 'ICU',
      })
    ).toBeUndefined();
    expect(consoleError).toHaveBeenCalled();
  });
});
