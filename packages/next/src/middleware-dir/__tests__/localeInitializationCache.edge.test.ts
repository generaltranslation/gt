// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GTRuntime } from 'generaltranslation/runtime';
import { NextRequest } from 'next/server';
import { createNextMiddleware } from '../createNextMiddleware';

beforeEach(() => {
  vi.stubEnv('_GENERALTRANSLATION_PATH_REGEX', '');
  vi.stubEnv('_GENERALTRANSLATION_GT_SERVICES_ENABLED', 'true');
  vi.stubEnv(
    '_GENERALTRANSLATION_I18N_CONFIG_PARAMS',
    JSON.stringify({
      defaultLocale: 'en',
      locales: ['en', 'en-gb', 'fr'],
      customMapping: { 'en-gb': { code: 'en-GB' } },
    })
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('locale resolution during middleware initialization', () => {
  it('bounds resolution work by distinct keys across aliases, overrides and availability', () => {
    const determineLocale = vi.spyOn(GTRuntime.prototype, 'determineLocale');
    const pathConfig = Object.fromEntries(
      Array.from({ length: 120 }, (_, i) => [
        `/page-${i}`,
        { en: `/alias-${i}`, 'en-GB': `/alias-${i}`, fr: `/alias-${i}` },
      ])
    );
    const middleware = createNextMiddleware({
      pathConfig,
      routeOverrides: { 'en-GB': ['/page-0'] },
      localeRoutes: { 'en-GB': ['/page-0'] },
    });
    expect(determineLocale).toHaveBeenCalledTimes(3);
    expect(determineLocale.mock.calls.map(([locale]) => locale).sort()).toEqual(
      ['en', 'en-GB', 'fr']
    );
    const response = middleware(
      new NextRequest('https://example.com/en-gb/alias-0')
    );
    expect(response.headers.get('x-middleware-rewrite')).toBe(
      'https://example.com/en-gb/en-gb/page-0'
    );
  });

  it.each(['false', 'true'])(
    'reuses string-alias locale resolutions with services=%s',
    (services) => {
      vi.stubEnv('_GENERALTRANSLATION_GT_SERVICES_ENABLED', services);
      const determineLocale = vi.spyOn(GTRuntime.prototype, 'determineLocale');
      const pathConfig = Object.fromEntries(
        Array.from({ length: 120 }, (_, i) => [`/page-${i}`, `/alias-${i}`])
      );
      const middleware = createNextMiddleware({ pathConfig });
      expect(determineLocale).toHaveBeenCalledTimes(3);
      const response = middleware(
        new NextRequest('https://example.com/en-gb/alias-0')
      );
      expect(response.headers.get('x-middleware-rewrite')).toBe(
        'https://example.com/en-gb/page-0'
      );
    }
  );

  it('keeps each factory cache scoped to its own locale configuration', () => {
    const options = { pathConfig: { '/page': { 'en-GB': '/alias' } } };
    const first = createNextMiddleware(options);
    vi.stubEnv(
      '_GENERALTRANSLATION_I18N_CONFIG_PARAMS',
      JSON.stringify({
        defaultLocale: 'en',
        locales: ['en', 'brand-uk'],
        customMapping: { 'brand-uk': { code: 'en-GB' } },
      })
    );
    const second = createNextMiddleware(options);
    expect(
      first(new NextRequest('https://example.com/en-gb/alias')).headers.get(
        'x-middleware-rewrite'
      )
    ).toBe('https://example.com/en-gb/page');
    expect(
      second(new NextRequest('https://example.com/brand-uk/alias')).headers.get(
        'x-middleware-rewrite'
      )
    ).toBe('https://example.com/brand-uk/page');
  });
});
