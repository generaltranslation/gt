import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { routeCreateTranslationLoader } from '../routeCreateTranslationLoader';
import { LoadTranslationsType } from '../../../utils/getLoadTranslationsType';

import { initializeI18nConfig } from '../../../../i18n-config/singleton-operations';

describe('routeCreateTranslationLoader', () => {
  beforeEach(() => {
    Reflect.deleteProperty(globalThis, '__generaltranslation');
  });
  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(globalThis, '__generaltranslation');
  });

  it('stays silent when loading is explicitly disabled with cacheUrl: null', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const loader = routeCreateTranslationLoader({
      type: LoadTranslationsType.DISABLED,
      remoteTranslationLoaderParams: { cacheUrl: null },
    });

    expect(await loader('en')).toEqual({});
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('warns once on invocation when no translation loader is configured', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const loader = routeCreateTranslationLoader({
      type: LoadTranslationsType.DISABLED,
      remoteTranslationLoaderParams: {},
    });

    // Warning is deferred until the loader is actually invoked
    expect(warnSpy).not.toHaveBeenCalled();

    expect(await loader('en')).toEqual({});
    expect(await loader('fr')).toEqual({});
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('No translation loader found')
    );
  });

  it('warns once on invocation when a remote store is missing a projectId', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const loader = routeCreateTranslationLoader({
      type: LoadTranslationsType.REMOTE,
      remoteTranslationLoaderParams: { cacheUrl: 'https://example.com' },
    });

    expect(warnSpy).not.toHaveBeenCalled();

    expect(await loader('en')).toEqual({});
    expect(await loader('fr')).toEqual({});
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('projectId'));
  });

  it('preserves the locale and result without an alias', async () => {
    initializeI18nConfig({ defaultLocale: 'en', locales: ['en', 'fr'] });
    const custom = vi.fn().mockResolvedValue({ hash: 'translation' });
    const loader = routeCreateTranslationLoader({
      type: LoadTranslationsType.CUSTOM,
      remoteTranslationLoaderParams: {},
      loadTranslations: custom,
    });

    expect(await loader('fr')).toEqual({ hash: 'translation' });
    expect(custom).toHaveBeenCalledWith('fr');
  });

  it.each(['en-GB', 'en-gb'])(
    'passes resolved cache identity unchanged to a custom loader: %s',
    async (locale) => {
      initializeI18nConfig({
        defaultLocale: 'en-US',
        locales: ['en-US', 'en-GB'],
        customMapping: { 'en-gb': { code: 'en-GB' } },
      });
      const custom = vi.fn().mockResolvedValue({ hash: 'British translation' });
      const loader = routeCreateTranslationLoader({
        type: LoadTranslationsType.CUSTOM,
        remoteTranslationLoaderParams: {},
        loadTranslations: custom,
      });

      expect(await loader(locale)).toEqual({ hash: 'British translation' });
      expect(custom).toHaveBeenCalledExactlyOnceWith(locale);
    }
  );

  it('keeps canonical locale URLs for remote loading with aliases', async () => {
    initializeI18nConfig({
      defaultLocale: 'en-US',
      locales: ['en-US', 'en-GB'],
      customMapping: { 'en-gb': { code: 'en-GB' } },
    });
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ hash: 'British translation' }))
      );
    const loader = routeCreateTranslationLoader({
      type: LoadTranslationsType.REMOTE,
      remoteTranslationLoaderParams: {
        cacheUrl: 'https://example.com',
        projectId: 'test-project',
      },
    });

    expect(await loader('en-gb')).toEqual({ hash: 'British translation' });
    expect(fetchSpy).toHaveBeenCalledExactlyOnceWith(
      'https://example.com/test-project/en-GB'
    );
  });
});
