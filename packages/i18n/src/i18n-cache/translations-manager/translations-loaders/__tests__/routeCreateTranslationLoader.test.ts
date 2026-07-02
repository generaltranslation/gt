import { describe, it, expect, vi, afterEach } from 'vitest';
import { routeCreateTranslationLoader } from '../routeCreateTranslationLoader';
import { LoadTranslationsType } from '../../../utils/getLoadTranslationsType';

describe('routeCreateTranslationLoader', () => {
  afterEach(() => {
    vi.restoreAllMocks();
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

  it('returns the custom loader as-is', async () => {
    const custom = async () => ({ hash: 'translation' });
    const loader = routeCreateTranslationLoader({
      type: LoadTranslationsType.CUSTOM,
      remoteTranslationLoaderParams: {},
      loadTranslations: custom,
    });

    expect(loader).toBe(custom);
  });
});
