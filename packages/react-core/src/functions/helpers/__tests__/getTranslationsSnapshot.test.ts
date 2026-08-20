import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReactI18nCache } from '../../../i18n-cache/ReactI18nCache';
import { setReactI18nCache } from '../../../i18n-cache/singleton-operations';
import { initializeI18nConfig } from '../../../setup/i18nConfig';
import { getTranslationsSnapshot } from '../getTranslationsSnapshot';

type TestGlobal = typeof globalThis & {
  __generaltranslation?: unknown;
};

function resetGTGlobals() {
  Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
}

function setup(loadTranslations: (locale: string) => Promise<unknown>) {
  initializeI18nConfig(
    {
      defaultLocale: 'en',
      locales: ['en', 'es'],
    },
    'SPA'
  );
  setReactI18nCache(new ReactI18nCache({ loadTranslations }));
}

describe('getTranslationsSnapshot', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetGTGlobals();
    consoleWarnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    resetGTGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('returns the loaded translations keyed by locale', async () => {
    setup(async () => ({ hash1: 'hola' }));

    await expect(getTranslationsSnapshot('es')).resolves.toEqual({
      es: { hash1: 'hola' },
    });
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it('development: omits the locale and warns when the loader fails', async () => {
    // Reproduces gt#1937: a translation file that does not exist yet must not
    // crash the caller (eg a TanStack Start route loader) with a 500
    vi.stubEnv('NODE_ENV', 'development');
    setup(() =>
      Promise.reject(new Error("Cannot find module './_gt/es.json'"))
    );

    await expect(getTranslationsSnapshot('es')).resolves.toEqual({});
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('"es"')
    );
  });

  it('development: retries the loader and recovers after a failed load', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const loadTranslations = vi
      .fn()
      .mockRejectedValueOnce(new Error("Cannot find module './_gt/es.json'"))
      .mockResolvedValue({ hash1: 'hola' });
    setup(loadTranslations);

    await expect(getTranslationsSnapshot('es')).resolves.toEqual({});
    await expect(getTranslationsSnapshot('es')).resolves.toEqual({
      es: { hash1: 'hola' },
    });
    expect(loadTranslations).toHaveBeenCalledTimes(2);
  });
});
