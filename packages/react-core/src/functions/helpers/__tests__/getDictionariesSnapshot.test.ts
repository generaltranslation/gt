import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReactI18nCache } from '../../../i18n-cache/ReactI18nCache';
import { setReactI18nCache } from '../../../i18n-cache/singleton-operations';
import { initializeI18nConfig } from '../../../setup/i18nConfig';
import { getDictionariesSnapshot } from '../getDictionariesSnapshot';

const source = { greeting: 'Hello' };

function setup(loadDictionary: (locale: string) => Promise<unknown>) {
  initializeI18nConfig({ defaultLocale: 'en', locales: ['en', 'es'] }, 'SPA');
  setReactI18nCache(new ReactI18nCache({ dictionary: source, loadDictionary }));
}

describe('getDictionariesSnapshot', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    Reflect.deleteProperty(globalThis, '__generaltranslation');
    consoleWarnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, '__generaltranslation');
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('includes the requested locale and the source dictionary', async () => {
    setup(async () => ({ greeting: 'Hola' }));

    await expect(getDictionariesSnapshot('es')).resolves.toEqual({
      en: source,
      es: { greeting: 'Hola' },
    });
  });

  it('reads the default locale without calling the loader', async () => {
    const loadDictionary = vi.fn(async () => ({}));
    setup(loadDictionary);

    await expect(getDictionariesSnapshot('en')).resolves.toEqual({
      en: source,
    });
    expect(loadDictionary).not.toHaveBeenCalled();
  });

  it('development: omits a failed locale, keeps the source, and warns', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    setup(() => Promise.reject(new Error('load failed')));

    await expect(getDictionariesSnapshot('es')).resolves.toEqual({
      en: source,
    });
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('"es"')
    );
  });

  it('production: the cache soft-fails, so a failed locale is empty', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    setup(() => Promise.reject(new Error('load failed')));

    await expect(getDictionariesSnapshot('es')).resolves.toEqual({
      en: source,
      es: {},
    });
  });
});
