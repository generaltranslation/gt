import { initializeI18nConfig } from '@generaltranslation/react-core/pure';
import { beforeEach, describe, expect, it } from 'vitest';
import { parseLocale } from '../parseLocale';

type TestGlobal = typeof globalThis & {
  __generaltranslation?: unknown;
};

function resetGTGlobals() {
  Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
}

function createRequest(headers: HeadersInit = {}): Request {
  return new Request('https://example.com', { headers });
}

describe('parseLocale(request)', () => {
  beforeEach(() => {
    resetGTGlobals();
    initializeI18nConfig({
      defaultLocale: 'en',
      locales: ['en', 'es', 'fr', 'brand-french'],
      customMapping: {
        'brand-french': {
          code: 'fr',
          name: 'Brand French',
        },
      },
    });
  });

  it('uses the locale cookie before Accept-Language', () => {
    const request = createRequest({
      cookie: 'other=value; generaltranslation.locale=brand-french',
      'accept-language': 'es,en;q=0.8',
    });

    expect(parseLocale(request)).toBe('fr');
  });

  it('uses the configured locale cookie name', () => {
    resetGTGlobals();
    initializeI18nConfig({
      defaultLocale: 'en',
      locales: ['en', 'es', 'fr'],
      localeCookieName: 'custom-locale',
    });
    const request = createRequest({
      cookie: 'generaltranslation.locale=es;custom-locale=fr',
    });

    expect(parseLocale(request)).toBe('fr');
  });

  it('falls back to Accept-Language in quality order', () => {
    const request = createRequest({
      cookie: 'generaltranslation.locale=unsupported',
      'accept-language': 'es;q=0.5, fr;q=0.9, en;q=0',
    });

    expect(parseLocale(request)).toBe('fr');
  });

  it('decodes the locale cookie value', () => {
    const request = createRequest({
      cookie: 'generaltranslation.locale=brand%2Dfrench',
    });

    expect(parseLocale(request)).toBe('fr');
  });

  it('falls back to the configured default locale', () => {
    expect(parseLocale(createRequest())).toBe('en');
  });
});
