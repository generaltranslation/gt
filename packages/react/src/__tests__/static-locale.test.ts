import { describe, expect, it } from 'vitest';
import { defaultDefaultLocale } from '@generaltranslation/format/internal';
import { defaultLocaleCookieName } from 'gt-i18n/internal/cookies';
import { negotiateLocale, type StaticLocaleConfig } from '../static-locale';

const config: StaticLocaleConfig = {
  defaultLocale: 'en',
  locales: ['fr', 'de', 'es'],
};

function webRequest({
  cookie,
  acceptLanguage,
}: {
  cookie?: string;
  acceptLanguage?: string;
}): Request {
  const headers = new Headers();
  if (cookie) headers.set('cookie', cookie);
  if (acceptLanguage) headers.set('accept-language', acceptLanguage);
  return new Request('http://localhost/', { headers });
}

const localeCookie = (locale: string) => `${defaultLocaleCookieName}=${locale}`;

describe('negotiateLocale', () => {
  it('prefers a supported locale cookie over Accept-Language', () => {
    const request = webRequest({
      cookie: localeCookie('de'),
      acceptLanguage: 'fr',
    });
    expect(negotiateLocale(request, config)).toBe('de');
  });

  it('orders Accept-Language by quality', () => {
    const request = webRequest({
      acceptLanguage: 'de;q=0.5, es;q=0.9, ja',
    });
    expect(negotiateLocale(request, config)).toBe('es');
  });

  it('falls back to the default locale', () => {
    expect(negotiateLocale(webRequest({}), config)).toBe('en');
    expect(
      negotiateLocale(webRequest({ acceptLanguage: 'ja, ko;q=0.8' }), config)
    ).toBe('en');
  });

  it('falls back to the library default locale without a configured one', () => {
    expect(negotiateLocale(webRequest({}), { locales: ['fr'] })).toBe(
      defaultDefaultLocale
    );
  });

  it('falls through an unsupported cookie to Accept-Language', () => {
    const request = webRequest({
      cookie: localeCookie('ja'),
      acceptLanguage: 'fr',
    });
    expect(negotiateLocale(request, config)).toBe('fr');
  });

  it('falls through an invalid cookie to Accept-Language', () => {
    const request = webRequest({
      cookie: localeCookie('not a locale'),
      acceptLanguage: 'fr',
    });
    expect(negotiateLocale(request, config)).toBe('fr');
  });

  it('resolves regional locales to their configured language', () => {
    expect(
      negotiateLocale(webRequest({ cookie: localeCookie('fr-CA') }), config)
    ).toBe('fr');
    expect(
      negotiateLocale(webRequest({ acceptLanguage: 'de-AT' }), config)
    ).toBe('de');
  });

  it('returns the configured spelling of a locale', () => {
    expect(
      negotiateLocale(webRequest({ acceptLanguage: 'fr-ca' }), {
        defaultLocale: 'en',
        locales: ['fr-CA', 'fr-FR'],
      })
    ).toBe('fr-CA');
  });

  it('resolves custom mapping aliases', () => {
    const aliasConfig: StaticLocaleConfig = {
      defaultLocale: 'en',
      locales: ['cn', 'fr'],
      customMapping: { cn: { code: 'zh-CN' } },
    };
    expect(
      negotiateLocale(webRequest({ acceptLanguage: 'zh-CN' }), aliasConfig)
    ).toBe('cn');
    expect(
      negotiateLocale(webRequest({ cookie: localeCookie('cn') }), aliasConfig)
    ).toBe('cn');
  });

  it('decodes the cookie value', () => {
    const request = webRequest({
      cookie: `other=1; ${defaultLocaleCookieName}=${encodeURIComponent('fr-CA')}`,
    });
    expect(negotiateLocale(request, config)).toBe('fr');
  });

  it('reads a renamed locale cookie', () => {
    const request = webRequest({
      cookie: 'my-locale=de',
      acceptLanguage: 'fr',
    });
    expect(
      negotiateLocale(request, { ...config, localeCookieName: 'my-locale' })
    ).toBe('de');
  });

  it('ignores Accept-Language with ignoreBrowserLocales', () => {
    const request = webRequest({ acceptLanguage: 'fr' });
    expect(
      negotiateLocale(request, { ...config, ignoreBrowserLocales: true })
    ).toBe('en');
  });

  it('reads Node request headers', () => {
    expect(
      negotiateLocale(
        {
          headers: {
            cookie: localeCookie('es'),
            'accept-language': ['fr', 'de'],
          },
        },
        config
      )
    ).toBe('es');
    expect(
      negotiateLocale(
        { headers: { 'accept-language': ['ja', 'de;q=0.9'] } },
        config
      )
    ).toBe('de');
  });

  it('reads headers passed without the request', () => {
    // Node's req.headers
    expect(
      negotiateLocale(
        { cookie: 'other=1', 'accept-language': 'ja, de;q=0.9' },
        config
      )
    ).toBe('de');
    expect(
      negotiateLocale(
        new Headers({ cookie: localeCookie('es'), 'accept-language': 'fr' }),
        config
      )
    ).toBe('es');
  });

  it('takes the last of repeated locale cookies, like the middleware', () => {
    const cookie = `${localeCookie('de')}; ${localeCookie('es')}`;
    expect(negotiateLocale(webRequest({ cookie }), config)).toBe('es');
    expect(negotiateLocale({ headers: { cookie } }, config)).toBe('es');
  });
});
