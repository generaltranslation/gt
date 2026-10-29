import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeI18nConfig } from '@generaltranslation/react-core/pure';
import { setCookie } from '@tanstack/react-start/server';
import { resolveRequestLocale } from '../requestConditions';

vi.mock('@tanstack/react-start/server', () => ({
  setCookie: vi.fn(),
}));

const config = {
  defaultLocale: 'en',
  locales: ['en', 'fr', 'es'],
};

function request(path: string, headers: Record<string, string> = {}) {
  return new Request(`https://example.com${path}`, { headers });
}

describe.sequential('resolveRequestLocale', () => {
  beforeEach(() => {
    Reflect.deleteProperty(globalThis, '__generaltranslation');
    initializeI18nConfig(config);
    vi.clearAllMocks();
  });
  afterEach(() => {
    Reflect.deleteProperty(globalThis, '__generaltranslation');
  });

  it('prefers the path locale, then the cookie, then Accept-Language', () => {
    const headers = {
      cookie: 'generaltranslation.locale=es',
      'accept-language': 'fr',
    };
    const routed = { ...config, localeRouting: true };

    expect(resolveRequestLocale(request('/fr/docs', headers), routed)).toBe(
      'fr'
    );
    expect(resolveRequestLocale(request('/docs', headers), routed)).toBe('es');
    expect(
      resolveRequestLocale(
        request('/docs', { 'accept-language': 'es;q=0.5, fr' }),
        routed
      )
    ).toBe('fr');
  });

  it('ignores the path locale without locale routing', () => {
    expect(
      resolveRequestLocale(
        request('/fr', { cookie: 'generaltranslation.locale=es' }),
        config
      )
    ).toBe('es');
  });

  it('falls back to the default locale for unknown candidates', () => {
    expect(
      resolveRequestLocale(
        request('/', {
          cookie: 'generaltranslation.locale=ja',
          'accept-language': 'de',
        }),
        config
      )
    ).toBe('en');
    expect(resolveRequestLocale(request('/'), config)).toBe('en');
  });

  it('reads the configured locale cookie name', () => {
    Reflect.deleteProperty(globalThis, '__generaltranslation');
    initializeI18nConfig({ ...config, localeCookieName: 'lang' });

    expect(
      resolveRequestLocale(
        request('/', {
          cookie: 'generaltranslation.locale=fr; lang=es',
        }),
        config
      )
    ).toBe('es');
  });

  it('does not write the locale cookie', () => {
    resolveRequestLocale(
      request('/', { cookie: 'generaltranslation.locale=fr' }),
      config
    );

    expect(setCookie).not.toHaveBeenCalled();
  });
});
