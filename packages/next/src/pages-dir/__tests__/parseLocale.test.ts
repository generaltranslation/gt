import type { GetServerSidePropsContext } from 'next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeI18nConfig } from '@generaltranslation/react-core/pure';
import { parseLocale, resolvePagesRouterLocale } from '../parseLocale';

type TestGlobal = typeof globalThis & {
  __generaltranslation?: unknown;
};

function resetGTGlobals() {
  Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
}

const localeConfig = {
  defaultLocale: 'en',
  locales: ['en', 'fr', 'es', 'brand-french'],
  customMapping: {
    'brand-french': {
      code: 'fr',
      name: 'Brand French',
    },
  },
};

function createContext({
  locale,
  defaultLocale,
  headers = {},
  cookies = {},
}: {
  locale?: string;
  defaultLocale?: string;
  headers?: Record<string, string | string[] | undefined>;
  cookies?: Record<string, string>;
}): GetServerSidePropsContext {
  return {
    locale,
    defaultLocale,
    req: {
      headers,
      cookies,
    },
  } as GetServerSidePropsContext;
}

describe('parseLocale', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetGTGlobals();
    initializeI18nConfig(localeConfig);
    delete process.env._GENERALTRANSLATION_I18N_CONFIG_PARAMS;
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  it('uses context.locale instead of headers, cookies, or Accept-Language', () => {
    const context = createContext({
      locale: 'fr',
      defaultLocale: 'en',
      headers: {
        'x-generaltranslation-locale': 'es',
        'accept-language': 'es',
      },
      cookies: {
        'generaltranslation.locale': 'es',
      },
    });

    expect(parseLocale(context)).toBe('fr');
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it('preserves a supported Next.js locale alias', () => {
    const context = createContext({
      locale: 'brand-french',
      defaultLocale: 'en',
    });

    expect(parseLocale(context)).toBe('brand-french');
  });

  it('falls back to the legacy header detector when context.locale is missing', () => {
    const context = createContext({
      defaultLocale: 'es',
      headers: {
        'x-generaltranslation-locale': 'brand-french',
        'accept-language': 'es',
      },
      cookies: {
        'generaltranslation.locale': 'es',
      },
    });

    expect(parseLocale(context)).toBe('fr');
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it('falls back through the legacy cookie and Accept-Language detector', () => {
    expect(
      parseLocale(
        createContext({
          headers: { 'accept-language': 'fr,en;q=0.8' },
          cookies: { 'generaltranslation.locale': 'es' },
        })
      )
    ).toBe('es');
    expect(
      parseLocale(
        createContext({
          headers: { 'accept-language': 'fr,en;q=0.8' },
        })
      )
    ).toBe('fr');
  });

  it('retains configured legacy header and cookie names in the fallback', () => {
    resetGTGlobals();
    initializeI18nConfig({
      ...localeConfig,
      localeCookieName: 'custom-locale',
    });
    process.env._GENERALTRANSLATION_I18N_CONFIG_PARAMS = JSON.stringify({
      headersAndCookies: {
        localeHeaderName: 'x-custom-locale',
      },
    });

    expect(
      parseLocale(
        createContext({
          headers: {
            'x-custom-locale': 'es',
            'accept-language': 'fr,en;q=0.8',
          },
          cookies: { 'custom-locale': 'brand-french' },
        })
      )
    ).toBe('es');
  });

  it('falls back to the GT default when legacy detection has no candidates', () => {
    expect(parseLocale(createContext({}))).toBe('en');
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('No locale could be determined')
    );
  });

  it('validates an unsupported context locale before returning it', () => {
    const context = createContext({
      locale: 'de',
      defaultLocale: 'en',
    });

    expect(parseLocale(context)).toBe('en');
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Locale "de" is not valid or is not supported')
    );
  });

  it('reports the resolved fallback when defaultLocale is unsupported', () => {
    expect(resolvePagesRouterLocale({ defaultLocale: 'de' })).toBe('en');
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('The locale "en" will be used')
    );
    expect(consoleWarnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('The locale "de" will be used')
    );
  });
});
