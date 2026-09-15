// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createNextMiddleware } from '../createNextMiddleware';

beforeEach(() => {
  vi.stubEnv('_GENERALTRANSLATION_GT_SERVICES_ENABLED', 'true');
  vi.stubEnv('_GENERALTRANSLATION_IGNORE_BROWSER_LOCALES', 'false');
  vi.stubEnv('_GENERALTRANSLATION_PATH_REGEX', '');
  vi.stubEnv(
    '_GENERALTRANSLATION_I18N_CONFIG_PARAMS',
    JSON.stringify({
      defaultLocale: 'en-us',
      locales: ['en-us', 'en-gb', 'fr'],
    })
  );
});
afterEach(() => vi.unstubAllEnvs());

describe('configured locale spellings without custom mappings', () => {
  it('keeps distinct configured aliases that share a canonical language', () => {
    vi.stubEnv(
      '_GENERALTRANSLATION_I18N_CONFIG_PARAMS',
      JSON.stringify({
        defaultLocale: 'en',
        locales: ['en', 'brand-uk', 'partner-uk'],
        customMapping: {
          'brand-uk': { code: 'en-GB' },
          'partner-uk': { code: 'en-GB' },
        },
      })
    );
    const middleware = createNextMiddleware({
      pathConfig: { '/pricing': { 'partner-uk': '/prices' } },
      routeOverrides: { 'partner-uk': ['/pricing'] },
      localeRoutes: { 'partner-uk': ['/pricing'] },
    });
    const res = middleware(
      new NextRequest('https://example.com/partner-uk/prices')
    );
    expect(res.headers.get('x-middleware-rewrite')).toBe(
      'https://example.com/partner-uk/partner-uk/pricing'
    );
  });
  it.each(['en-gb', 'en-GB', 'EN-gb'])(
    'resolves cookie %s to the configured route',
    (locale) => {
      const req = new NextRequest('https://example.com/pricing');
      req.cookies.set('generaltranslation.locale', locale);
      const res = createNextMiddleware()(req);
      expect(res.headers.get('location')).toBe(
        'https://example.com/en-gb/pricing'
      );
    }
  );

  it('keeps a generated lowercase route and redirects equivalent spelling to it', () => {
    const middleware = createNextMiddleware();
    expect(
      middleware(
        new NextRequest('https://example.com/en-gb/pricing')
      ).headers.get('location')
    ).toBeNull();
    expect(
      middleware(
        new NextRequest('https://example.com/en-GB/pricing')
      ).headers.get('location')
    ).toBe('https://example.com/en-gb/pricing');
  });

  it('rewrites the default locale with its configured spelling', () => {
    const res = createNextMiddleware()(
      new NextRequest('https://example.com/pricing')
    );
    expect(res.headers.get('x-middleware-rewrite')).toBe(
      'https://example.com/en-us/pricing'
    );
  });

  it('uses configured keys for aliases, overrides and route restrictions', () => {
    const middleware = createNextMiddleware({
      pathConfig: { '/pricing': { 'en-gb': '/prices', 'en-us': '/plans' } },
      routeOverrides: { 'en-gb': ['/pricing'] },
      localeRoutes: { 'en-gb': ['/pricing'] },
    });
    const res = middleware(new NextRequest('https://example.com/en-gb/prices'));
    expect(res.headers.get('x-middleware-rewrite')).toBe(
      'https://example.com/en-gb/en-gb/pricing'
    );
    const fallback = middleware(
      new NextRequest('https://example.com/en-gb/careers')
    );
    expect(fallback.headers.get('location')).toBe(
      'https://example.com/careers'
    );
  });
});
