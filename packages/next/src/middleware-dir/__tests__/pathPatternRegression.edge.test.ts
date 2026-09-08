// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { defaultLocaleCookieName } from 'gt-i18n/internal/cookies';
import { defaultLocaleHeaderName } from '../../utils/headers';
import { createNextMiddleware } from '../createNextMiddleware';

describe('literal default-locale dynamic aliases', () => {
  beforeEach(() => {
    vi.stubEnv(
      '_GENERALTRANSLATION_I18N_CONFIG_PARAMS',
      JSON.stringify({ defaultLocale: 'en', locales: ['en', 'fr'] })
    );
    vi.stubEnv('_GENERALTRANSLATION_GT_SERVICES_ENABLED', undefined);
    vi.stubEnv('_GENERALTRANSLATION_IGNORE_BROWSER_LOCALES', undefined);
    vi.stubEnv('_GENERALTRANSLATION_PATH_REGEX', undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    ['v1.0', 'v1X0'],
    ['a+b', 'aaab'],
    ['docs(v2)', 'docsv2'],
    ['left|right', 'left'],
    ['cost$', 'cost'],
  ])(
    'recognizes %s before the locale cookie, but not %s',
    (literal, lookalike) => {
      const middleware = createNextMiddleware({
        prefixDefaultLocale: false,
        pathConfig: {
          '/shared/articles/[id]': {
            en: `/english/${literal}/[id]`,
            fr: '/french/articles/[id]',
          },
        },
      });
      const request = (segment: string) => {
        const req = new NextRequest(
          `http://localhost:3000/english/${segment}/one`
        );
        req.cookies.set(defaultLocaleCookieName, 'fr');
        return req;
      };

      const matched = middleware(request(literal));
      expect(matched.headers.get(defaultLocaleHeaderName)).toBe('en');
      expect(matched.headers.get('location')).toBeNull();
      expect(
        new URL(matched.headers.get('x-middleware-rewrite')!).pathname
      ).toBe('/en/shared/articles/one');

      const unmatched = middleware(request(lookalike));
      expect(unmatched.headers.get(defaultLocaleHeaderName)).toBe('fr');
      expect(unmatched.headers.get('x-middleware-rewrite')).toBeNull();
      expect(new URL(unmatched.headers.get('location')!).pathname).toBe(
        `/fr/english/${lookalike}/one`
      );
    }
  );
});
