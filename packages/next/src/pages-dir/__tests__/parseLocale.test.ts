import type { GetServerSidePropsContext } from 'next';
import { beforeEach, describe, expect, it } from 'vitest';
import { initializeI18nConfig } from 'gt-i18n/internal';
import { parseLocale } from '../parseLocale';

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
    process.env._GENERALTRANSLATION_I18N_CONFIG_PARAMS = JSON.stringify({
      headersAndCookies: {
        localeHeaderName: 'x-custom-locale',
        localeCookieName: 'custom-locale',
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

  it('uses the raw cookie header when parsed cookies are unavailable', () => {
    const context = createContext({
      headers: {
        cookie: 'other=value; generaltranslation.locale=fr',
        'accept-language': 'en-US,en;q=0.8',
      },
    });

    expect(parseLocale(context)).toBe('fr');
  });
});
