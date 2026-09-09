// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { defaultLocaleHeaderName } from '../../utils/headers';
import { createNextMiddleware } from '../createNextMiddleware';
import type { PathConfig } from '../utils';

beforeEach(() => {
  vi.stubEnv(
    '_GENERALTRANSLATION_I18N_CONFIG_PARAMS',
    JSON.stringify({ defaultLocale: 'en', locales: ['en', 'fr'] })
  );
  vi.stubEnv('_GENERALTRANSLATION_GT_SERVICES_ENABLED', 'false');
  vi.stubEnv('_GENERALTRANSLATION_IGNORE_BROWSER_LOCALES', 'true');
  vi.stubEnv('_GENERALTRANSLATION_PATH_REGEX', '');
});
afterEach(() => vi.unstubAllEnvs());

const origin = 'http://localhost:3000';
const query = '?tag=a&tag=b&raw=%2F%252F';
const configurations: { name: string; pathConfig: PathConfig }[] = [
  {
    name: 'French-only homepage alias',
    pathConfig: { '/': { fr: '/accueil' } },
  },
  {
    name: 'explicit default homepage alias',
    pathConfig: { '/': { en: '/', fr: '/accueil' } },
  },
  {
    name: 'empty optional root catchall',
    pathConfig: {
      '/[[...slug]]': { en: '/[[...slug]]', fr: '/pages/[[...slug]]' },
    },
  },
];

describe.each(configurations)('$name', ({ pathConfig }) => {
  it('rewrites the unprefixed homepage without redirecting to itself', () => {
    const middleware = createNextMiddleware({
      prefixDefaultLocale: false,
      pathConfig,
    });
    const response = middleware(new NextRequest(origin + '/' + query));

    expect(response.headers.get('location')).toBeNull();
    const rewrite = response.headers.get('x-middleware-rewrite');
    expect(rewrite).not.toBeNull();
    const destination = new URL(rewrite!);
    // Either internal root slash style is valid; the public URL must terminate.
    expect(destination.pathname.replace(/\/$/, '')).toBe('/en');
    expect(destination.origin).toBe(origin);
    expect(destination.search).toBe(query);
    expect(response.headers.get(defaultLocaleHeaderName)).toBe('en');
  });

  it('keeps the explicitly prefixed homepage as a terminating control', () => {
    const middleware = createNextMiddleware({
      prefixDefaultLocale: true,
      pathConfig,
    });
    const response = middleware(new NextRequest(origin + '/en/' + query));

    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(response.headers.get(defaultLocaleHeaderName)).toBe('en');
  });
});
