import type { GetServerSidePropsContext } from 'next';
import { beforeEach, describe, expect, it } from 'vitest';
import { initializeI18nConfig } from '@generaltranslation/react-core/pure';
import { parseLocale } from '../parseLocale';

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
  headers = {},
  cookies = {},
}: {
  headers?: Record<string, string | string[] | undefined>;
  cookies?: Record<string, string>;
}): GetServerSidePropsContext {
  return {
    req: {
      headers,
      cookies,
    },
  } as GetServerSidePropsContext;
}

describe('parseLocale', () => {
  beforeEach(() => {
    resetGTGlobals();
    initializeI18nConfig(localeConfig);
    delete process.env._GENERALTRANSLATION_I18N_CONFIG_PARAMS;
  });

  it('uses the middleware locale header before cookies and Accept-Language', () => {
    const context = createContext({
      headers: {
        'x-generaltranslation-locale': 'brand-french',
        'accept-language': 'es,en;q=0.8',
      },
      cookies: {
        'generaltranslation.locale': 'es',
      },
    });

    expect(parseLocale(context)).toBe('fr');
  });

  it('uses configured header and cookie names', () => {
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
    const context = createContext({
      headers: {
        'x-custom-locale': 'es',
        'accept-language': 'fr,en;q=0.8',
      },
      cookies: {
        'custom-locale': 'brand-french',
      },
    });

    expect(parseLocale(context)).toBe('es');
  });

  it('falls back to Accept-Language', () => {
    const context = createContext({
      headers: {
        'accept-language': 'es,en;q=0.8',
      },
    });

    expect(parseLocale(context)).toBe('es');
  });
});
