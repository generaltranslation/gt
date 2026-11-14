// @vitest-environment edge-runtime
import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import {
  defaultLocaleCookieName,
  defaultResetLocaleCookieName,
} from 'gt-i18n/internal/cookies';
import { defaultLocaleHeaderName } from '../../utils/headers';
import { createNextMiddleware } from '../createNextMiddleware';
import type { PathConfig } from '../createPathMatcher';
import { getResponse } from '../utils';
import { useRoutingEnv } from './routingTestUtils';

const origin = 'http://localhost:3000';

useRoutingEnv();

describe('encoded and Unicode paths', () => {
  const request = (path: string) => new NextRequest(origin + path);

  it.each(['caf%C3%A9-fran%C3%A7ais', 'café-français', 'cafe\u0301-français'])(
    'matches Unicode pathConfig entries against %s',
    (alias) => {
      const middleware = createNextMiddleware({
        prefixDefaultLocale: true,
        pathConfig: { '/café/[slug]': { fr: '/café-français/[slug]' } },
      });
      const response = middleware(request('/fr/' + alias + '/article'));
      expect(response.headers.get('location')).toBeNull();
      expect(response.headers.get('x-middleware-rewrite')).toBe(
        origin + '/fr/caf%C3%A9/article'
      );
    }
  );

  describe.each([true, false])(
    'encoded paths, prefixDefaultLocale=%s',
    (prefixDefaultLocale) => {
      it.each(['bad%escape', '%E0%A4%A'])(
        'normalizes static segments independently of malformed parameter %s',
        (value) => {
          for (const alias of ['/café', '/notes%5Bfr%5D']) {
            const middleware = createNextMiddleware({
              prefixDefaultLocale,
              pathConfig: {
                '/docs/[id]': { en: alias + '/[id]', fr: alias + '/[id]' },
              },
            });
            for (const locale of ['en', 'fr']) {
              const prefix =
                locale === 'en' && !prefixDefaultLocale ? '' : '/' + locale;
              const response = middleware(
                request(prefix + alias + '/' + value + '?tag=a&tag=b')
              );
              expect(response.headers.get('location')).toBeNull();
              expect(response.headers.get('x-middleware-rewrite')).toBe(
                origin + '/' + locale + '/docs/' + value + '?tag=a&tag=b'
              );
            }
          }
        }
      );

      it.each([
        'a%252Fb',
        '100%25',
        'a%5Cb',
        'a%0Ab',
        'a%09b',
        'a%0Db',
        'a%2Fb',
        'a%3Fb',
        'a%23b',
        'a%26b',
        '%C3%A9',
        'e%CC%81',
        'a%255Cb',
        '%252e%252e',
        '%E0%A4%A',
        'bad%escape',
      ])(
        'preserves parameter bytes for %s through redirects and rewrites',
        (value) => {
          const middleware = createNextMiddleware({
            prefixDefaultLocale,
            pathConfig: {
              '/posts/[id]': { en: '/entries/[id]', fr: '/articles/[id]' },
            },
          });
          for (const locale of ['en', 'fr']) {
            const prefix =
              locale === 'en' && !prefixDefaultLocale ? '' : '/' + locale;
            const alias = locale === 'en' ? '/entries/' : '/articles/';
            const publicPath = prefix + alias + value;
            const response = middleware(request(publicPath + '?tag=a&tag=b'));
            expect(response.headers.get('location')).toBeNull();
            expect(response.headers.get('x-middleware-rewrite')).toBe(
              origin + '/' + locale + '/posts/' + value + '?tag=a&tag=b'
            );
            const redirect = middleware(
              request(prefix + '/posts/' + value + '?tag=a&tag=b')
            );
            expect(redirect.headers.get('location')).toBe(
              origin + publicPath + '?tag=a&tag=b'
            );
          }
        }
      );

      it.each(['/notes%5Bfr%5D', '/cafe\u0301', '/café', '/c++', '/100%25'])(
        'terminates for encoded or Unicode static template %s',
        (alias) => {
          const middleware = createNextMiddleware({
            prefixDefaultLocale,
            pathConfig: { '/docs': { en: alias, fr: alias } },
          });
          for (const locale of ['en', 'fr']) {
            const prefix =
              locale === 'en' && !prefixDefaultLocale ? '' : '/' + locale;
            const response = middleware(request(prefix + alias));
            expect(response.headers.get('location')).toBeNull();
            expect(response.headers.get('x-middleware-rewrite')).toBe(
              origin + '/' + locale + '/docs'
            );
          }
        }
      );
    }
  );

  it('does not decode a double-encoded static segment twice', () => {
    const middleware = createNextMiddleware({
      prefixDefaultLocale: true,
      pathConfig: { '/docs/[id]': { fr: '/café/[id]' } },
    });
    const response = middleware(request('/fr/caf%25C3%25A9/123'));
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('x-middleware-rewrite')).toBeNull();
  });

  it.each(['%5Bid%5D', '%5B...slug%5D', '%5B%5B...slug%5D%5D'])(
    'does not promote encoded literal %s into a dynamic route',
    (literal) => {
      const middleware = createNextMiddleware({
        prefixDefaultLocale: true,
        pathConfig: { '/docs': { fr: '/' + literal } },
      });
      const unrelated = middleware(request('/fr/unrelated'));
      expect(unrelated.headers.get('location')).toBeNull();
      expect(unrelated.headers.get('x-middleware-rewrite')).toBeNull();
      const matched = middleware(request('/fr/' + literal));
      expect(matched.headers.get('location')).toBeNull();
      expect(matched.headers.get('x-middleware-rewrite')).toBe(
        origin + '/fr/docs'
      );
    }
  );

  it('keeps encoded shared literals ahead of localized dynamic aliases', () => {
    const middleware = createNextMiddleware({
      prefixDefaultLocale: true,
      pathConfig: {
        '/%5Bid%5D': { en: '/%5Bid%5D' },
        '/docs/[slug]': { fr: '/[slug]' },
      },
    });
    const response = middleware(request('/fr/%5Bid%5D'));
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('x-middleware-rewrite')).toBeNull();
  });

  // Percent-escapes of the URI reserved set, which decodeURI() leaves encoded.
  const reservedEscapes = [
    '2F',
    '3F',
    '23',
    '26',
    '3A',
    '3B',
    '2B',
    '3D',
    '24',
    '2C',
    '40',
  ];

  it.each(reservedEscapes)(
    'does not match a double-encoded request against a static %s alias',
    (escape) => {
      const middleware = createNextMiddleware({
        pathConfig: { '/docs': { fr: '/a%' + escape + 'b' } },
      });
      const response = middleware(request('/fr/a%25' + escape + 'b'));
      expect(response.headers.get('location')).toBeNull();
      expect(response.headers.get('x-middleware-rewrite')).toBeNull();
    }
  );

  it('keeps encoded regex-looking static segments literal', () => {
    const alias = '/literal/%5B%5E/%5D+';
    const middleware = createNextMiddleware({
      pathConfig: { '/docs': { fr: alias } },
    });
    const unrelated = middleware(request('/fr/literal/unrelated'));
    expect(unrelated.headers.get('location')).toBeNull();
    expect(unrelated.headers.get('x-middleware-rewrite')).toBeNull();

    const matched = middleware(request('/fr' + alias));
    expect(matched.headers.get('location')).toBeNull();
    expect(matched.headers.get('x-middleware-rewrite')).toBe(
      origin + '/fr/docs'
    );
  });

  describe.each([true, false])(
    'route identity, prefixDefaultLocale=%s',
    (prefixDefaultLocale) => {
      it.each(reservedEscapes)(
        'keeps aliases containing %s distinct from double-encoded aliases',
        (escape) => {
          for (const suffix of ['', '/[id]']) {
            const firstAlias = '/a%' + escape + 'b';
            const secondAlias = '/a%25' + escape + 'b';
            const middleware = createNextMiddleware({
              prefixDefaultLocale,
              pathConfig: {
                ['/one' + suffix]: {
                  en: firstAlias + suffix,
                  fr: firstAlias + suffix,
                },
                ['/two' + suffix]: {
                  en: secondAlias + suffix,
                  fr: secondAlias + suffix,
                },
              },
            });
            const parameter = suffix ? '/value%252Fpart' : '';
            for (const locale of ['en', 'fr']) {
              const prefix =
                locale === 'en' && !prefixDefaultLocale ? '' : '/' + locale;
              for (const [alias, shared] of [
                [firstAlias, '/one'],
                [secondAlias, '/two'],
              ]) {
                const response = middleware(
                  request(prefix + alias + parameter + '?tag=a&tag=b')
                );
                expect(response.headers.get('location')).toBeNull();
                expect(response.headers.get('x-middleware-rewrite')).toBe(
                  origin + '/' + locale + shared + parameter + '?tag=a&tag=b'
                );
              }
            }
          }
        }
      );

      it('rewrites a decomposed alias to the shared route spelling', () => {
        const middleware = createNextMiddleware({
          prefixDefaultLocale,
          pathConfig: { '/café': { en: '/cafe%CC%81', fr: '/cafe%CC%81' } },
        });
        for (const locale of ['en', 'fr']) {
          const prefix =
            locale === 'en' && !prefixDefaultLocale ? '' : '/' + locale;
          const response = middleware(request(prefix + '/cafe%CC%81'));
          expect(response.headers.get('location')).toBeNull();
          expect(response.headers.get('x-middleware-rewrite')).toBe(
            origin + '/' + locale + '/caf%C3%A9'
          );
        }
      });
    }
  );
});

describe('encoded locale-like segments', () => {
  const query = '?tag=a&tag=b';

  describe.each([false, true])(
    'encoded locale-like route segments, prefixDefaultLocale=%s',
    (prefixDefaultLocale) => {
      it.each([
        ['%66r', 'articles'],
        ['f%72', 'articles'],
        ['%65n', 'entries'],
        ['e%6E', 'entries'],
        ['%2566r', 'articles'],
        ['bad%escape', 'articles'],
        ['%E0%A4%A', 'articles'],
      ])(
        'preserves category %s and the ID in /%s routes',
        (category, alias) => {
          const middleware = createNextMiddleware({
            prefixDefaultLocale,
            pathConfig: {
              '/posts/[id]': { en: '/entries/[id]', fr: '/articles/[id]' },
              [`/[category]/${alias}/[id]`]: {
                en: `/[category]/${alias}/[id]`,
              },
            },
          });
          for (const id of ['one', 'value%252Fpart', 'bad%escape']) {
            const path = `/${category}/${alias}/${id}`;
            const response = middleware(new NextRequest(origin + path + query));
            const destination = origin + '/en' + path + query;
            expect(response.headers.get('location')).toBe(
              prefixDefaultLocale ? destination : null
            );
            expect(response.headers.get('x-middleware-rewrite')).toBe(
              prefixDefaultLocale ? null : destination
            );
          }
        }
      );

      it.each(['%66r', 'f%72', 'fr'])(
        'preserves category %s after an actual locale prefix',
        (category) => {
          const middleware = createNextMiddleware({
            prefixDefaultLocale,
            pathConfig: {
              '/posts/[id]': { en: '/entries/[id]', fr: '/articles/[id]' },
              '/[category]/articles/[id]': { en: '/[category]/articles/[id]' },
            },
          });
          const response = middleware(
            new NextRequest(`${origin}/fr/${category}/articles/a${query}`)
          );

          expect(response.headers.get('location')).toBeNull();
          expect(response.headers.get('x-middleware-rewrite')).toBeNull();
          expect(response.headers.get('x-generaltranslation-locale')).toBe(
            'fr'
          );
          expect(
            response.cookies.get('generaltranslation.locale-routing-enabled')
              ?.value
          ).toBe('true');
        }
      );

      it('does not match an exact localized alias after removing the locale prefix', () => {
        const middleware = createNextMiddleware({
          prefixDefaultLocale,
          pathConfig: {
            '/posts': { en: '/entries', fr: '/articles' },
            '/[category]/articles': { en: '/[category]/articles' },
          },
        });
        const response = middleware(
          new NextRequest(`${origin}/fr/%66r/articles${query}`)
        );

        expect(response.headers.get('location')).toBeNull();
        expect(response.headers.get('x-middleware-rewrite')).toBeNull();
        expect(response.headers.get('x-generaltranslation-locale')).toBe('fr');
      });

      it.each(['en', 'fr'])(
        'still recognizes the literal %s prefix',
        (locale) => {
          const middleware = createNextMiddleware({
            prefixDefaultLocale,
            pathConfig: {
              '/posts/[id]': { en: '/entries/[id]', fr: '/articles/[id]' },
              '/[category]/articles/[id]': { en: '/[category]/articles/[id]' },
            },
          });
          const alias = locale === 'en' ? 'entries' : 'articles';
          const response = middleware(
            new NextRequest(`${origin}/${locale}/${alias}/one${query}`)
          );
          expect(response.headers.get('location')).toBeNull();
          expect(response.headers.get('x-middleware-rewrite')).toBe(
            `${origin}/${locale}/posts/one${query}`
          );
        }
      );

      it('does not consume an encoded locale when no unprefixed route matches', () => {
        const middleware = createNextMiddleware({
          prefixDefaultLocale,
          pathConfig: { '/posts/[id]': { fr: '/articles/[id]' } },
        });
        const response = middleware(
          new NextRequest(origin + '/%66r/articles/one' + query)
        );
        const destination = origin + '/en/%66r/articles/one' + query;
        expect(response.headers.get('location')).toBe(
          prefixDefaultLocale ? destination : null
        );
        expect(response.headers.get('x-middleware-rewrite')).toBe(
          prefixDefaultLocale ? null : destination
        );
      });

      it('still normalizes a shared static path beginning with an encoded locale', () => {
        const middleware = createNextMiddleware({
          prefixDefaultLocale,
          pathConfig: {
            '/posts': { fr: '/café' },
            '/fr/café': { en: '/category' },
          },
        });
        const response = middleware(
          new NextRequest(origin + '/%66r/cafe%CC%81' + query)
        );
        expect(response.headers.get('location')).toBe(
          origin + (prefixDefaultLocale ? '/en' : '') + '/category' + query
        );
        expect(response.headers.get('x-middleware-rewrite')).toBeNull();
      });
    }
  );

  it('still normalizes unprefixed default aliases and gives them locale precedence', () => {
    const middleware = createNextMiddleware({
      prefixDefaultLocale: false,
      pathConfig: {
        '/posts/[id]': { fr: '/café/[id]' },
        '/categories/[id]/article': {
          en: '/fr/[id]/article',
          fr: '/catégories/[id]/article',
        },
      },
    });
    const response = middleware(
      new NextRequest(origin + '/%66r/cafe%CC%81/article' + query, {
        headers: { cookie: 'generaltranslation.locale=fr' },
      })
    );
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('x-middleware-rewrite')).toBe(
      origin + '/en/categories/cafe%CC%81/article' + query
    );
  });
});

describe('trailing slashes: route ownership and source templates', () => {
  const query = '?tag=a&tag=b';

  describe.each(['', '/'])(
    'route ownership with trailing slash %j',
    (slash) => {
      it('does not treat the locale root as a locale-named shared page', () => {
        const middleware = createNextMiddleware({
          prefixDefaultLocale: true,
          pathConfig: { '/fr': { en: '/fr', fr: '/other' } },
        });
        const response = middleware(
          new NextRequest(`${origin}/fr${slash}${query}`)
        );
        expect(response.headers.get('location')).toBeNull();
        expect(response.headers.get('x-middleware-rewrite')).toBeNull();
        expect(response.headers.get('x-generaltranslation-locale')).toBe('fr');
      });

      it.each([false, true])(
        'keeps dynamic route ownership in reverse order %s',
        (reverse) => {
          const entries: [string, Record<string, string>][] = [
            ['/[id]', { en: '/[id]', fr: '/[id]' }],
            ['/fr/[id]', { en: '/fr/[id]', fr: '/other/[id]' }],
          ];
          const middleware = createNextMiddleware({
            prefixDefaultLocale: true,
            pathConfig: Object.fromEntries(
              reverse ? entries.reverse() : entries
            ),
          });
          const response = middleware(
            new NextRequest(`${origin}/fr/hello${slash}${query}`)
          );
          expect(response.headers.get('location')).toBeNull();
          expect(response.headers.get('x-middleware-rewrite')).toBeNull();
        }
      );

      it.each([false, true])(
        'keeps an explicit localized root alias in reverse order %s',
        (reverse) => {
          const entries: [string, Record<string, string>][] = [
            ['/landing', { en: '/home', fr: '/' }],
            ['/fr', { en: '/fr', fr: '/other' }],
          ];
          const middleware = createNextMiddleware({
            prefixDefaultLocale: true,
            pathConfig: Object.fromEntries(
              reverse ? entries.reverse() : entries
            ),
          });
          const response = middleware(
            new NextRequest(`${origin}/fr${slash}${query}`)
          );
          expect(response.headers.get('location')).toBeNull();
          expect(response.headers.get('x-middleware-rewrite')).toBe(
            `${origin}/fr/landing${slash}${query}`
          );
        }
      );
    }
  );

  const depthCases: [
    string,
    PathConfig,
    string,
    string,
    'location' | 'x-middleware-rewrite',
  ][] = [
    [
      'shared to deeper alias',
      {
        '/short/[a]/[b]': {
          en: '/short/[a]/[b]',
          fr: '/long/static/[first]/[second]',
        },
      },
      '/fr/short/alpha/beta',
      '/fr/long/static/alpha/beta',
      'location',
    ],
    [
      'deeper alias to shared',
      {
        '/short/[a]/[b]': {
          en: '/short/[a]/[b]',
          fr: '/long/static/[first]/[second]',
        },
      },
      '/fr/long/static/alpha/beta',
      '/fr/short/alpha/beta',
      'x-middleware-rewrite',
    ],
    [
      'shared to shallower alias',
      {
        '/long/static/[a]/[b]': {
          en: '/long/static/[a]/[b]',
          fr: '/short/[first]/[second]',
        },
      },
      '/fr/long/static/alpha/beta',
      '/fr/short/alpha/beta',
      'location',
    ],
    [
      'shallower alias to shared',
      {
        '/long/static/[a]/[b]': {
          en: '/long/static/[a]/[b]',
          fr: '/short/[first]/[second]',
        },
      },
      '/fr/short/alpha/beta',
      '/fr/long/static/alpha/beta',
      'x-middleware-rewrite',
    ],
    [
      'same-depth reordered names remain positional',
      { '/pair/[first]/[second]': { fr: '/paire/[second]/[first]' } },
      '/fr/paire/alpha/beta',
      '/fr/pair/alpha/beta',
      'x-middleware-rewrite',
    ],
  ];

  describe.each(['', '/'])(
    'source-template parameters with trailing slash %j',
    (slash) => {
      it.each(depthCases)(
        '%s',
        (_name, pathConfig, path, destination, header) => {
          const middleware = createNextMiddleware({
            prefixDefaultLocale: true,
            pathConfig,
          });
          const response = middleware(
            new NextRequest(origin + path + slash + query)
          );
          expect(response.headers.get(header)).toBe(
            origin + destination + slash + query
          );
          expect(
            response.headers.get(
              header === 'location' ? 'x-middleware-rewrite' : 'location'
            )
          ).toBeNull();
          expect(response.headers.get('x-generaltranslation-locale')).toBe(
            'fr'
          );
        }
      );

      it.each(['a%2Fb', 'a%25b', 'a%252Fb'])(
        'preserves raw parameter %s across different depths',
        (value) => {
          const middleware = createNextMiddleware({
            prefixDefaultLocale: true,
            pathConfig: {
              '/short/[a]/[b]': { fr: '/long/static/[first]/[second]' },
            },
          });
          const response = middleware(
            new NextRequest(`${origin}/fr/short/${value}/beta${slash}${query}`)
          );
          expect(response.headers.get('location')).toBe(
            `${origin}/fr/long/static/${value}/beta${slash}${query}`
          );
          const localized = middleware(
            new NextRequest(
              `${origin}/fr/long/static/${value}/beta${slash}${query}`
            )
          );
          expect(localized.headers.get('location')).toBeNull();
          expect(localized.headers.get('x-middleware-rewrite')).toBe(
            `${origin}/fr/short/${value}/beta${slash}${query}`
          );
        }
      );

      it('uses the source locale template during a cookie locale switch', () => {
        const middleware = createNextMiddleware({
          prefixDefaultLocale: true,
          pathConfig: {
            '/short/[a]/[b]': {
              en: '/short/[a]/[b]',
              fr: '/long/static/[first]/[second]',
            },
          },
        });
        const response = middleware(
          new NextRequest(
            `${origin}/fr/long/static/alpha/beta${slash}${query}`,
            {
              headers: {
                cookie:
                  'generaltranslation.locale=en; generaltranslation.locale-reset=true',
              },
            }
          )
        );
        expect(response.headers.get('location')).toBe(
          `${origin}/en/short/alpha/beta${slash}${query}`
        );
      });

      it('uses the actual unprefixed default alias template', () => {
        const middleware = createNextMiddleware({
          prefixDefaultLocale: false,
          pathConfig: {
            '/short/[a]/[b]': {
              en: '/long/static/[first]/[second]',
              fr: '/autre/[first]/[second]',
            },
          },
        });
        const response = middleware(
          new NextRequest(`${origin}/long/static/alpha/beta${slash}${query}`)
        );
        expect(response.headers.get('location')).toBeNull();
        expect(response.headers.get('x-middleware-rewrite')).toBe(
          `${origin}/en/short/alpha/beta${slash}${query}`
        );
      });
    }
  );
});

describe('trailing slashes: configured and requested', () => {
  describe.each([true, false])(
    'prefixDefaultLocale=%s',
    (prefixDefaultLocale) => {
      describe.each(['', '/'])('configured slash="%s"', (configuredSlash) => {
        it.each(['', '/'])('preserves request slash="%s"', (slash) => {
          const middleware = createNextMiddleware({
            prefixDefaultLocale,
            pathConfig: {
              ['/about' + configuredSlash]: {
                en: '/company' + configuredSlash,
                fr: '/a-propos' + configuredSlash,
              },
              ['/posts/[id]' + configuredSlash]: {
                en: '/entries/[id]' + configuredSlash,
                fr: '/articles/[id]' + configuredSlash,
              },
            },
          });
          for (const locale of ['en', 'fr']) {
            const prefix =
              locale === 'en' && !prefixDefaultLocale ? '' : '/' + locale;
            const aliases =
              locale === 'en'
                ? ['/company', '/entries/123']
                : ['/a-propos', '/articles/123'];
            for (const [index, shared] of ['/about', '/posts/123'].entries()) {
              const publicPath = prefix + aliases[index] + slash;
              const response = middleware(
                new NextRequest(origin + publicPath + '?tag=a&tag=b')
              );
              expect(response.headers.get('location')).toBeNull();
              expect(response.headers.get('x-middleware-rewrite')).toBe(
                origin + '/' + locale + shared + slash + '?tag=a&tag=b'
              );
              const redirect = middleware(
                new NextRequest(origin + prefix + shared + slash)
              );
              expect(redirect.headers.get('location')).toBe(
                origin + publicPath
              );
            }
          }
        });
      });
    }
  );

  it('keeps the locale landing slash when matching the shared root', () => {
    const middleware = createNextMiddleware({
      prefixDefaultLocale: true,
      pathConfig: { '/': { fr: '/home' } },
    });
    const response = middleware(new NextRequest(origin + '/fr/'));
    expect(response.headers.get('location')).toBe(origin + '/fr/home/');
  });

  // Requests under /fr never consult prefixDefaultLocale.
  describe('locale root routing', () => {
    it('resolves a localized root alias and preserves repeated query values', () => {
      const middleware = createNextMiddleware({
        pathConfig: { '/landing/': { en: '/home/', fr: '/' } },
      });
      const response = middleware(new NextRequest(origin + '/fr/?tag=a&tag=b'));
      expect(response.headers.get('location')).toBeNull();
      expect(response.headers.get('x-middleware-rewrite')).toBe(
        origin + '/fr/landing/?tag=a&tag=b'
      );
    });

    it('prefers the localized root alias over an unrelated shared root', () => {
      const middleware = createNextMiddleware({
        pathConfig: {
          '/': { fr: '/accueil/' },
          '/landing/': { fr: '/' },
        },
      });
      const response = middleware(new NextRequest(origin + '/fr/'));
      expect(response.headers.get('location')).toBeNull();
      expect(response.headers.get('x-middleware-rewrite')).toBe(
        origin + '/fr/landing/'
      );
    });

    it('does not use the locale as a missing root slug', () => {
      const middleware = createNextMiddleware({
        pathConfig: { '/[slug]': { en: '/[slug]', fr: '/[slug]' } },
      });
      const response = middleware(new NextRequest(origin + '/fr/?tag=a&tag=b'));
      expect(response.headers.get('location')).toBeNull();
      expect(response.headers.get('x-middleware-rewrite')).toBeNull();
      expect(response.headers.get('x-middleware-next')).toBe('1');
    });

    it.each(['', '/'])(
      'still resolves a real root slug, slash="%s"',
      (slash) => {
        const middleware = createNextMiddleware({
          pathConfig: { '/[slug]/edit': { fr: '/[slug]/modifier' } },
        });
        const response = middleware(
          new NextRequest(
            origin + '/fr/hello%2Fworld/edit' + slash + '?tag=a&tag=b'
          )
        );
        expect(response.headers.get('location')).toBe(
          origin + '/fr/hello%2Fworld/modifier' + slash + '?tag=a&tag=b'
        );
        const localizedResponse = middleware(
          new NextRequest(
            origin + '/fr/hello%2Fworld/modifier' + slash + '?tag=a&tag=b'
          )
        );
        expect(localizedResponse.headers.get('location')).toBeNull();
        expect(localizedResponse.headers.get('x-middleware-rewrite')).toBe(
          origin + '/fr/hello%2Fworld/edit' + slash + '?tag=a&tag=b'
        );
      }
    );
  });
});

describe('trailing slashes: catch-all routes', () => {
  const query = '?tag=a&tag=b&raw=%2F%252F';

  describe.each(['[...slug]', '[[...slug]]'])(
    'catchall trailing delimiter, %s',
    (segment) => {
      it.each(['', 'one', 'one/two', 'a%2Fb/a%252Fb'])(
        'routes %s without redirecting to a double trailing slash',
        (tail) => {
          const middleware = createNextMiddleware({
            prefixDefaultLocale: true,
            pathConfig: {
              [`/catalog/[category]/${segment}/`]: {
                en: `/catalog/[category]/${segment}/`,
                fr: `/catalogue/[category]/${segment}/`,
              },
            },
          });
          for (const slash of ['', '/']) {
            const suffix = `/science${tail ? '/' + tail : ''}${slash}`;
            const sharedUrl = origin + '/fr/catalog' + suffix + query;
            const localizedUrl = origin + '/fr/catalogue' + suffix + query;
            const localized = middleware(new NextRequest(localizedUrl));
            const shared = middleware(new NextRequest(sharedUrl));
            if (!tail && segment === '[...slug]') {
              for (const response of [localized, shared]) {
                expect(response.headers.get('location')).toBeNull();
                expect(response.headers.get('x-middleware-rewrite')).toBeNull();
                expect(response.headers.get('x-middleware-next')).toBe('1');
              }
              continue;
            }
            expect(localized.headers.get(defaultLocaleHeaderName)).toBe('fr');
            expect(localized.headers.get('location')).toBeNull();
            expect(localized.headers.get('x-middleware-rewrite')).toBe(
              sharedUrl
            );
            expect(shared.headers.get('location')).toBe(localizedUrl);
            const followed = middleware(
              new NextRequest(shared.headers.get('location')!)
            );
            expect(followed.headers.get('location')).toBeNull();
            expect(followed.headers.get('x-middleware-rewrite')).toBe(
              sharedUrl
            );
          }
        }
      );
    }
  );

  it('preserves singular parameters beside configured trailing slashes', () => {
    const middleware = createNextMiddleware({
      prefixDefaultLocale: true,
      pathConfig: {
        '/catalog/[category]/[id]/': {
          fr: '/catalogue/[category]/[id]/',
        },
      },
    });
    const response = middleware(
      new NextRequest(origin + '/fr/catalogue/science/a%2Fb/' + query)
    );
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('x-middleware-rewrite')).toBe(
      origin + '/fr/catalog/science/a%2Fb/' + query
    );
  });
});

describe('base paths', () => {
  describe.each(['redirect', 'rewrite'] as const)(
    'getResponse %s to the app root',
    (type) => {
      it.each(['', '/'])(
        'preserves the incoming base-path root slash "%s"',
        (slash) => {
          const url = origin + '/corp/nested' + slash + '?tag=a&tag=b&raw=%2F';
          const req = new NextRequest(url, {
            nextConfig: { basePath: '/corp/nested', trailingSlash: !!slash },
          });
          const response = getResponse({
            type,
            originalUrl: req.nextUrl,
            responsePath: '/',
            userLocale: 'en',
            clearResetCookie: false,
            headerList: new Headers(),
            localeRouting: true,
            localeRoutingEnabledCookieName: 'locale-routing',
            resetLocaleCookieName: defaultResetLocaleCookieName,
            localeHeaderName: 'x-locale',
          });

          expect(response.status).toBe(type === 'redirect' ? 307 : 200);
          expect(
            response.headers.get(
              type === 'redirect' ? 'location' : 'x-middleware-rewrite'
            )
          ).toBe(url);
        }
      );
    }
  );

  // Locale-named base paths must not be mistaken for locale prefixes.
  describe.each(['/fr', '/en', '/corp/nested'])('basePath=%s', (basePath) => {
    describe.each([false, true])('trailingSlash=%s', (trailingSlash) => {
      const slash = trailingSlash ? '/' : '';
      const query = '?tag=a&tag=b&raw=%2F';
      const request = (path: string) =>
        new NextRequest(origin + basePath + path + query, {
          nextConfig: { basePath, trailingSlash },
        });

      it('redirects a locale reset directly to the base-path root', () => {
        const middleware = createNextMiddleware({
          prefixDefaultLocale: false,
        });
        const req = request('/fr' + slash);
        req.cookies.set(defaultLocaleCookieName, 'en');
        req.cookies.set(defaultResetLocaleCookieName, 'true');

        const response = middleware(req);

        expect(response.status).toBe(307);
        expect(response.headers.get('location')).toBe(
          origin + basePath + slash + query
        );
        const followed = middleware(
          new NextRequest(response.headers.get('location')!, {
            headers: req.headers,
            nextConfig: { basePath, trailingSlash },
          })
        );
        expect(followed.headers.get('location')).toBeNull();
        expect(followed.headers.get('x-middleware-rewrite')).toBe(
          origin + basePath + '/en/' + query
        );
      });

      it('handles a request for the base-path root', () => {
        const middleware = createNextMiddleware({
          prefixDefaultLocale: false,
        });
        const response = middleware(request(slash));

        expect(response.headers.get('location')).toBeNull();
        expect(response.headers.get('x-middleware-rewrite')).toBe(
          origin + basePath + '/en/' + query
        );
      });
    });

    it.each(['', '/'])(
      'retains a same-named app route (trailing slash "%s")',
      (slash) => {
        const middleware = createNextMiddleware({
          prefixDefaultLocale: false,
          pathConfig: {
            '/about': { en: basePath + '/about', fr: '/a-propos' },
          },
        });
        const request = (path: string) =>
          new NextRequest(origin + basePath + path, {
            nextConfig: { basePath },
          });
        const response = middleware(request('/about' + slash + '?tag=a&tag=b'));
        expect(response.headers.get('location')).toBe(
          origin + basePath + basePath + '/about' + slash + '?tag=a&tag=b'
        );
      }
    );
    it('retains a locale prefix identical to the base path', () => {
      const middleware = createNextMiddleware({
        prefixDefaultLocale: true,
        pathConfig: { '/posts/[id]': { fr: '/articles/[id]' } },
      });
      const response = middleware(
        new NextRequest(origin + basePath + '/fr/articles/123', {
          nextConfig: { basePath },
        })
      );
      expect(response.headers.get('location')).toBeNull();
      expect(response.headers.get('x-middleware-rewrite')).toBe(
        origin + basePath + '/fr/posts/123'
      );
    });
  });
});

describe('same-origin destinations', () => {
  const query = '?tag=a&tag=b&raw=%2F';

  describe.each(['redirect', 'rewrite'] as const)('%s destinations', (type) => {
    describe.each(['', '/corp'])('basePath="%s"', (basePath) => {
      it.each(['//evil.example/x', '/\\evil.example/x'])(
        'keeps %s on the request origin',
        (responsePath) => {
          const request = new NextRequest(
            origin + basePath + '/source' + query,
            {
              nextConfig: { basePath },
            }
          );
          const response = getResponse({
            type,
            originalUrl: request.nextUrl,
            responsePath,
            userLocale: 'en',
            clearResetCookie: false,
            headerList: new Headers(),
            localeRouting: true,
            localeRoutingEnabledCookieName: 'locale-routing',
            resetLocaleCookieName: 'reset-locale',
            localeHeaderName: 'x-locale',
          });

          expect(response.status).toBe(type === 'redirect' ? 307 : 200);
          expect(
            response.headers.get(
              type === 'redirect' ? 'location' : 'x-middleware-rewrite'
            )
          ).toBe(origin + basePath + '//evil.example/x' + query);
        }
      );
    });
  });

  describe('catch-all alias redirects', () => {
    it.each(['/docs//evil.example/x', '/docs/\\evil.example/x'])(
      'keeps the redirect for %s on the request origin without cookies',
      (pathname) => {
        const middleware = createNextMiddleware({
          prefixDefaultLocale: false,
          pathConfig: { '/docs/[...slug]': { en: '/[...slug]' } },
        });
        const response = middleware(new NextRequest(origin + pathname + query));

        expect(response.status).toBe(307);
        expect(response.headers.get('location')).toBe(
          origin + '//evil.example/x' + query
        );
      }
    );
  });
});
