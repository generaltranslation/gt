import { describe, it, expect } from 'vitest';
import {
  extractLocale,
  extractDynamicParams,
  replaceDynamicSegments,
  getLocalizedPath,
  createPathMatcher,
  createPathToSharedPathMap,
  getSharedPath as matchSharedPath,
  type PathConfig,
} from '../utils';

function getSharedPath(...args: Parameters<typeof matchSharedPath>) {
  return matchSharedPath(...args)?.sharedPath;
}

describe('extractLocale', () => {
  it.each([
    ['/en/about', 'en'],
    ['/es/', 'es'],
    ['/de', 'de'],
    ['/zh-CN/page', 'zh-CN'],
    // Any first segment is returned; validating it is the caller's job.
    ['/products/123', 'products'],
    ['/caf%C3%A9/menu', 'caf%C3%A9'],
    ['/', null],
    ['', null],
    ['no-leading-slash', null],
  ])('returns the first segment of %j', (pathname, expected) => {
    expect(extractLocale(pathname)).toBe(expected);
  });
});

describe('extractDynamicParams', () => {
  it.each([
    ['/blog/[id]', '/blog/123', ['123']],
    ['/user/[id]/post/[postId]', '/user/456/post/789', ['456', '789']],
    ['/api/users/[id]/settings', '/api/users/123/settings', ['123']],
    ['/about/us', '/about/us', []],
    ['', '', []],
    // Mismatched lengths
    ['/blog/[id]', '/blog', [undefined]],
    ['/[a]/[b]/[c]', '/x/y', ['x', 'y', undefined]],
    ['/[param]', '/one/two/three', ['one']],
    ['/[param]', '/', ['']],
    // Catch-all segments
    ['/docs/[...slug]', '/docs/api/auth', ['api/auth']],
    ['/posts/[[...slug]]', '/posts/2023/article', ['2023/article']],
    ['/posts/[[...slug]]', '/posts', ['']],
  ])('extracts %s from %s', (template, path, expected) => {
    expect(extractDynamicParams(template, path)).toEqual(expected);
  });
});

describe('replaceDynamicSegments', () => {
  it.each([
    ['/blog/123', '/blog/[id]', '/blog/123'],
    ['/user/456/post/789', '/user/[id]/post/[postId]', '/user/456/post/789'],
    ['/api/users/123/settings', '/api/users/[id]/settings'],
    // Catch-all segments
    ['/docs/api/auth', '/docs/[...slug]'],
    ['/posts/2023/article', '/posts/[[...slug]]'],
    ['/posts', '/posts/[[...slug]]'],
    // Static templates are returned as-is
    ['/blog/123', '/about', '/about'],
    // The request's trailing-slash style wins
    ['/blog/123/', '/articles/[id]', '/articles/123/'],
    ['/about/', '/company', '/company/'],
    ['/about', '/company/', '/company'],
    // Missing parameters keep their placeholder
    ['/blog', '/blog/[id]/[slug]', '/blog/[id]/[slug]'],
    ['/one', '/[a]/[b]/[c]', '/one/[b]/[c]'],
  ])('fills %s into %s', (path, template, expected = path) => {
    expect(replaceDynamicSegments(path, template)).toBe(expected);
  });

  it('reads parameters with the source template when it differs', () => {
    expect(
      replaceDynamicSegments(
        '/fr/knowledge/base/api/auth',
        '/fr/docs/[...slug]',
        '/fr/knowledge/base/[...slug]'
      )
    ).toBe('/fr/docs/api/auth');
  });
});

describe('getLocalizedPath', () => {
  const pathConfig: PathConfig = {
    '/contact': '/contact-us',
    '/about': { en: '/about-us', fr: '/a-propos' },
    '/blog/[id]': { en: '/blog/[id]', fr: '/article/[id]' },
  };

  it.each([
    // A string applies to every locale
    ['/contact', 'fr', '/fr/contact-us'],
    ['/about', 'en', '/en/about-us'],
    ['/about', 'fr', '/fr/a-propos'],
    // Locales without an entry fall back to the shared path
    ['/about', 'de', '/de/about'],
    ['/blog/[id]', 'fr', '/fr/article/[id]'],
    ['/nonexistent', 'en', undefined],
  ])('localizes %s for %s', (sharedPath, locale, expected) => {
    expect(getLocalizedPath(sharedPath, locale, pathConfig)).toBe(expected);
  });
});

describe('createPathToSharedPathMap', () => {
  const pathConfig: PathConfig = {
    '/services': '/our-services',
    '/about': { en: '/about-us', fr: '/a-propos' },
    '/blog/[id]': { en: '/blog/[id]', fr: '/article/[id]' },
  };

  it('indexes shared and locale-prefixed localized paths', () => {
    const { pathToSharedPath, defaultLocalePaths } = createPathToSharedPathMap(
      pathConfig,
      true,
      'en'
    );

    expect(getSharedPath('/services', pathToSharedPath, undefined)).toBe(
      '/services'
    );
    expect(getSharedPath('/about', pathToSharedPath, undefined)).toBe('/about');
    expect(getSharedPath('/en/about-us', pathToSharedPath, 'en')).toBe(
      '/about'
    );
    expect(getSharedPath('/fr/a-propos', pathToSharedPath, 'fr')).toBe(
      '/about'
    );
    expect(getSharedPath('/blog/1', pathToSharedPath, undefined)).toBe(
      '/blog/[id]'
    );
    expect(getSharedPath('/fr/article/3', pathToSharedPath, 'fr')).toBe(
      '/blog/[id]'
    );
    // With a prefixed default locale there are no unprefixed default paths.
    expect(
      getSharedPath('/about-us', defaultLocalePaths, undefined)
    ).toBeUndefined();
  });

  it('indexes unprefixed default-locale paths when the default is unprefixed', () => {
    const { pathToSharedPath, defaultLocalePaths } = createPathToSharedPathMap(
      pathConfig,
      false,
      'en'
    );

    expect(getSharedPath('/about-us', pathToSharedPath, undefined)).toBe(
      '/about'
    );
    expect(getSharedPath('/fr/a-propos', pathToSharedPath, 'fr')).toBe(
      '/about'
    );
    expect(getSharedPath('/about-us', defaultLocalePaths, undefined)).toBe(
      '/about'
    );
  });
});

describe('getSharedPath', () => {
  const pathToSharedPath = createPathMatcher([
    ['/about', '/about'],
    ['/en/about-us', '/about'],
    ['/fr/a-propos', '/about'],
    ['/blog/[id]', '/blog/[id]'],
    ['/fr/article/[id]', '/blog/[id]'],
    ['/user/[id]/settings', '/user/[id]/settings'],
  ]);

  it('returns the shared path and matched source route', () => {
    expect(matchSharedPath('/fr/article/789', pathToSharedPath, 'fr')).toEqual({
      matchedPathname: '/fr/article/789',
      pathTemplate: '/fr/article/[id]',
      sharedPath: '/blog/[id]',
    });
  });

  it.each([
    ['/about', undefined, '/about'],
    ['/en/about-us', 'en', '/about'],
    ['/fr/a-propos', 'fr', '/about'],
    ['/blog/123', undefined, '/blog/[id]'],
    ['/user/john/settings', undefined, '/user/[id]/settings'],
    ['/nonexistent', undefined, undefined],
    ['/en/nonexistent', 'en', undefined],
    ['/', undefined, undefined],
    ['', undefined, undefined],
    ['/en/', 'en', undefined],
  ])('matches %j with pathname locale %s', (pathname, locale, expected) => {
    expect(getSharedPath(pathname, pathToSharedPath, locale)).toBe(expected);
  });

  it('normalizes encoded and Unicode path segments', () => {
    const pathMatcher = createPathMatcher([
      ['/café/[slug]', '/café/[slug]'],
      ['/articles/élite/[slug]', '/articles/élite/[slug]'],
      ['/files/%2F/[slug]', '/files/%2F/[slug]'],
    ]);

    expect(getSharedPath('/caf%C3%A9/guide', pathMatcher, undefined)).toBe(
      '/café/[slug]'
    );
    expect(getSharedPath('/café/guide', pathMatcher, undefined)).toBe(
      '/café/[slug]'
    );
    expect(
      getSharedPath('/articles/%C3%A9lite/guide', pathMatcher, undefined)
    ).toBe('/articles/élite/[slug]');
    expect(getSharedPath('/files/%2F/guide', pathMatcher, undefined)).toBe(
      '/files/%2F/[slug]'
    );
  });

  it('matches catch-all and optional catch-all paths', () => {
    const pathMatcher = createPathMatcher([
      ['/docs/[...slug]', '/docs/[...slug]'],
      ['/news/[[...slug]]', '/news/[[...slug]]'],
    ]);

    expect(getSharedPath('/docs/intro', pathMatcher, undefined)).toBe(
      '/docs/[...slug]'
    );
    expect(getSharedPath('/docs/guides/start', pathMatcher, undefined)).toBe(
      '/docs/[...slug]'
    );
    expect(getSharedPath('/docs', pathMatcher, undefined)).toBe(undefined);
    expect(getSharedPath('/news', pathMatcher, undefined)).toBe(
      '/news/[[...slug]]'
    );
    expect(getSharedPath('/news/world/latest', pathMatcher, undefined)).toBe(
      '/news/[[...slug]]'
    );
  });

  it('accepts matcher inputs without a leading slash', () => {
    const matcher = createPathMatcher([['docs/[slug]', '/docs/[slug]']]);

    expect(matchSharedPath('docs/guide', matcher, undefined)).toMatchObject({
      pathTemplate: 'docs/[slug]',
      sharedPath: '/docs/[slug]',
    });
  });

  it('backtracks from a static dead end to a valid dynamic route', () => {
    const matcher = createPathMatcher([
      ['/docs/fixed/introduction', '/static'],
      ['/docs/[section]/reference', '/dynamic'],
    ]);

    expect(
      matchSharedPath('/docs/fixed/reference', matcher, undefined)
    ).toMatchObject({
      pathTemplate: '/docs/[section]/reference',
      sharedPath: '/dynamic',
    });
  });

  // Mirrors the previous map behavior: the later entry wins when two
  // parameter names describe the same path shape.
  it.each([
    ['/products/[firstId]', '/products/[secondId]', '/products/card'],
    ['/docs/[...firstSlug]', '/docs/[...secondSlug]', '/docs/guides/start'],
    ['/news/[[...firstSlug]]', '/news/[[...secondSlug]]', '/news'],
  ])('lets %s lose to the later %s', (first, second, pathname) => {
    const matcher = createPathMatcher([
      [first, '/first'],
      [second, '/second'],
    ]);

    expect(matchSharedPath(pathname, matcher, undefined)).toMatchObject({
      pathTemplate: second,
      sharedPath: '/second',
    });
  });

  it.each([
    // One of each malformed class: bare and truncated escapes, non-hex
    // digits, and truncated, invalid, or surrogate UTF-8 sequences.
    '/%',
    '/safe/%0',
    '/safe/%2G',
    '/safe/value%GG',
    '/safe/%C3',
    '/safe/%E0%A4%A',
    '/safe/%F0%28%8C%28',
    '/safe/%ED%A0%80',
  ])('does not throw for malformed pathname %s', (path) => {
    const matcher = createPathMatcher([['/safe/[slug]', '/safe/[slug]']]);

    expect(() => matchSharedPath(path, matcher, undefined)).not.toThrow();
  });
});

/**
 * Two namespaces register every route shape in one matcher so that neighbors
 * cannot shadow each other; the second flips trailing slashes and encoding.
 */
describe('path matcher route shapes', () => {
  const pathEntries: Array<readonly [string, string]> = [];
  const matchCases: {
    label: string;
    pathname: string;
    pathTemplate: string;
    sharedPath: string;
  }[] = [];

  for (const index of [1, 2]) {
    const namespace = `/tenant-${index}`;
    const even = index % 2 === 0;
    const slashIfEven = even ? '/' : '';
    const slashIfOdd = even ? '' : '/';
    const routes = [
      {
        label: 'prefers a static route',
        template: `${namespace}/docs/fixed`,
        pathname: `${namespace}/docs/fixed${slashIfEven}`,
      },
      {
        label: 'falls back to a dynamic route',
        template: `${namespace}/docs/[section]`,
        pathname: `${namespace}/docs/api${slashIfOdd}`,
      },
      {
        label: 'falls back to a required catch-all route',
        template: `${namespace}/docs/[...slug]`,
        pathname: `${namespace}/docs/api/auth/version${slashIfEven}`,
      },
      {
        label: 'matches an empty optional catch-all route',
        template: `${namespace}/updates/[[...slug]]`,
        pathname: `${namespace}/updates${slashIfOdd}`,
      },
      {
        label: 'matches a populated optional catch-all route',
        template: `${namespace}/updates/[[...slug]]`,
        pathname: `${namespace}/updates/world/latest/story${slashIfEven}`,
      },
      {
        label: 'matches multiple dynamic segments',
        template: `${namespace}/accounts/[accountId]/cards/[cardId]`,
        pathname: `${namespace}/accounts/account/cards/card${slashIfOdd}`,
      },
      {
        label: 'normalizes encoded Unicode',
        template: `${namespace}/café/[slug]`,
        pathname: `${namespace}/${even ? 'caf%C3%A9' : 'café'}/article`,
      },
    ];

    for (const { label, template, pathname } of routes) {
      const sharedPath = `/shared${template}`;
      pathEntries.push([template, sharedPath]);
      matchCases.push({
        label: `namespace ${index} ${label}`,
        pathname,
        pathTemplate: template,
        sharedPath,
      });
    }
  }

  const matcher = createPathMatcher(pathEntries);

  it.each(matchCases)('$label', ({ pathname, pathTemplate, sharedPath }) => {
    expect(matchSharedPath(pathname, matcher, undefined)).toEqual({
      matchedPathname: pathname,
      pathTemplate,
      sharedPath,
    });
  });
});

describe('configured dynamic route literals', () => {
  const literals = [
    ['v1.0', 'v1X0'],
    ['a+b', 'aaab'],
    ['docs(v2)', 'docsv2'],
    ['left|right', 'left'],
    ['cost$', 'cost'],
  ];

  it.each(literals)(
    'matches shared and localized %s literally and rejects %s',
    (literal, lookalike) => {
      const sharedPath = `/shared/${literal}/[id]`;
      const { pathToSharedPath } = createPathToSharedPathMap(
        {
          [sharedPath]: {
            en: `/english/${literal}/[id]`,
            fr: `/french/${literal}/[id]`,
          },
        },
        false,
        'en'
      );

      for (const [prefix, locale] of [
        ['/shared', undefined],
        ['/english', undefined],
        ['/fr/french', 'fr'],
      ] as const) {
        expect(
          getSharedPath(`${prefix}/${literal}/one`, pathToSharedPath, locale)
        ).toBe(sharedPath);
        expect(
          getSharedPath(`${prefix}/${lookalike}/one`, pathToSharedPath, locale)
        ).toBeUndefined();
        expect(
          getSharedPath(
            `${prefix}/${literal}/one/two`,
            pathToSharedPath,
            locale
          )
        ).toBeUndefined();
      }
    }
  );

  it('prefers exact static routes over earlier dynamic and catch-all routes', () => {
    const { pathToSharedPath } = createPathToSharedPathMap(
      {
        '/v1.0/[...slug]': { fr: '/version.1/[...slug]' },
        '/v1.0/[id]': { fr: '/version.1/[id]' },
        '/v1.0/new': { fr: '/version.1/new' },
      },
      false,
      'en'
    );

    expect(getSharedPath('/v1.0/new', pathToSharedPath, undefined)).toBe(
      '/v1.0/new'
    );
    expect(getSharedPath('/fr/version.1/new', pathToSharedPath, 'fr')).toBe(
      '/v1.0/new'
    );
    expect(getSharedPath('/v1.0/other', pathToSharedPath, undefined)).toBe(
      '/v1.0/[id]'
    );
    expect(getSharedPath('/v1.0/other/deep', pathToSharedPath, undefined)).toBe(
      '/v1.0/[...slug]'
    );
  });

  it('keeps encoded brackets literal beside a real placeholder', () => {
    const sharedPath = '/%5Bid%5D/[slug]';
    const { pathToSharedPath } = createPathToSharedPathMap(
      { [sharedPath]: { fr: '/%5Barticle%5D/[slug]' } },
      false,
      'en'
    );

    expect(getSharedPath('/%5Bid%5D/one', pathToSharedPath, undefined)).toBe(
      sharedPath
    );
    expect(getSharedPath('/fr/%5Barticle%5D/one', pathToSharedPath, 'fr')).toBe(
      sharedPath
    );
    expect(
      getSharedPath('/anything/one', pathToSharedPath, undefined)
    ).toBeUndefined();
    expect(
      getSharedPath('/fr/anything/one', pathToSharedPath, 'fr')
    ).toBeUndefined();
  });
});
