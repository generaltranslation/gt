// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setGlobalTranslationsSnapshot } from '@generaltranslation/react-core/pure';
import { initializeGTSPA } from '../initializeGTSPA';

vi.mock('@generaltranslation/react-core/pure', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('@generaltranslation/react-core/pure')
  >()),
  setGlobalTranslationsSnapshot: vi.fn(),
}));

type TestGlobal = typeof globalThis & { __generaltranslation?: unknown };

const originalNodeEnv = process.env.NODE_ENV;

function resetGTGlobals() {
  Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
}

describe('initializeGTSPA in production', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetGTGlobals();
    vi.mocked(setGlobalTranslationsSnapshot).mockClear();
    process.env.NODE_ENV = 'production';
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    resetGTGlobals();
    process.env.NODE_ENV = originalNodeEnv;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const baseConfig = {
    defaultLocale: 'en',
    locales: ['en', 'fr'],
    locale: 'fr',
  };

  function warnings() {
    return warnSpy.mock.calls.map((call) => String(call[0]));
  }

  it('warns when a custom cacheUrl has no projectId', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    await initializeGTSPA({ ...baseConfig, cacheUrl: 'https://cdn.test' });

    expect(warnings()).toEqual([
      expect.stringContaining(
        'Loading translations from a remote store needs a projectId'
      ),
    ]);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(setGlobalTranslationsSnapshot).toHaveBeenCalledWith({ fr: {} });
  });

  it('warns when no translation loader is configured', async () => {
    await initializeGTSPA(baseConfig);

    expect(warnings()).toEqual([
      expect.stringContaining('No translation loader was found'),
    ]);
  });

  it('does not warn when translation loading is disabled with cacheUrl: null', async () => {
    await initializeGTSPA({ ...baseConfig, cacheUrl: null });

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('does not warn for the default locale', async () => {
    await initializeGTSPA({ ...baseConfig, locale: 'en' });

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('loads from the GT remote store when a projectId is configured', async () => {
    const fetchSpy = vi.fn(async () => Response.json({ hash: 'Bonjour' }));
    vi.stubGlobal('fetch', fetchSpy);

    await initializeGTSPA({ ...baseConfig, projectId: 'project-id' });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain('project-id');
    expect(setGlobalTranslationsSnapshot).toHaveBeenCalledWith({
      fr: { hash: 'Bonjour' },
    });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('logs failed translation loads as errors', async () => {
    await initializeGTSPA({
      ...baseConfig,
      loadTranslations: async () => {
        throw new Error('not found');
      },
    });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(String(errorSpy.mock.calls[0]?.[0])).toContain(
      'Could not load translations for locale "fr"'
    );
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('logs failed dictionary loads as errors', async () => {
    await initializeGTSPA({
      ...baseConfig,
      loadTranslations: async () => ({}),
      loadDictionary: async () => {
        throw new Error('not found');
      },
    });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(String(errorSpy.mock.calls[0]?.[0])).toContain(
      'Could not load the dictionary for locale "fr"'
    );
  });
});
