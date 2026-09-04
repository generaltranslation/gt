import { describe, it, expect } from 'vitest';
import {
  extractLocale,
  extractDynamicParams,
  replaceDynamicSegments,
  getLocalizedPath,
  createPathMatcher,
  createPathToSharedPathMap,
  getSharedPath,
  type PathConfig,
} from '../utils';

describe('extractLocale', () => {
  it('should extract locale from various pathname formats', () => {
    expect(extractLocale('/en/about')).toBe('en');
    expect(extractLocale('/fr/dashboard')).toBe('fr');
    expect(extractLocale('/es/')).toBe('es');
    expect(extractLocale('/de')).toBe('de');
    expect(extractLocale('/zh-CN/page')).toBe('zh-CN');
    expect(extractLocale('/en-US/profile')).toBe('en-US');
  });

  it('should extract first segment from any pathname', () => {
    expect(extractLocale('/about')).toBe('about');
    expect(extractLocale('/products/123')).toBe('products');
    expect(extractLocale('/admin/users/edit')).toBe('admin');
  });

  it('should return null for edge cases', () => {
    expect(extractLocale('/')).toBe(null);
    expect(extractLocale('')).toBe(null);
    expect(extractLocale('no-leading-slash')).toBe(null);
  });

  it('should handle special characters and encoded segments', () => {
    expect(extractLocale('/en%20US/page')).toBe('en%20US');
    expect(extractLocale('/caf%C3%A9/menu')).toBe('caf%C3%A9');
  });
});

describe('extractDynamicParams', () => {
  it('should extract single dynamic parameter', () => {
    expect(extractDynamicParams('/blog/[id]', '/blog/123')).toEqual(['123']);
    expect(extractDynamicParams('/user/[userId]', '/user/abc-def')).toEqual([
      'abc-def',
    ]);
    expect(extractDynamicParams('/posts/[slug]', '/posts/hello-world')).toEqual(
      ['hello-world']
    );
  });

  it('should extract multiple dynamic parameters', () => {
    expect(
      extractDynamicParams('/user/[id]/post/[postId]', '/user/456/post/789')
    ).toEqual(['456', '789']);
    expect(
      extractDynamicParams('/[locale]/[category]/[slug]', '/en/tech/article-1')
    ).toEqual(['en', 'tech', 'article-1']);
  });

  it('should handle mixed static and dynamic segments', () => {
    expect(
      extractDynamicParams(
        '/api/users/[id]/settings',
        '/api/users/123/settings'
      )
    ).toEqual(['123']);
    expect(
      extractDynamicParams(
        '/docs/[version]/api/[endpoint]',
        '/docs/v2/api/users'
      )
    ).toEqual(['v2', 'users']);
  });

  it('should return empty array when no dynamic segments exist', () => {
    expect(extractDynamicParams('/blog', '/blog')).toEqual([]);
    expect(extractDynamicParams('/about/us', '/about/us')).toEqual([]);
    expect(
      extractDynamicParams('/static/path/here', '/static/path/here')
    ).toEqual([]);
  });

  it('should handle mismatched path lengths', () => {
    expect(extractDynamicParams('/blog/[id]', '/blog')).toEqual([undefined]);
    expect(extractDynamicParams('/[a]/[b]/[c]', '/x/y')).toEqual([
      'x',
      'y',
      undefined,
    ]);
    expect(extractDynamicParams('/[param]', '/one/two/three')).toEqual(['one']);
  });

  it('should handle edge cases', () => {
    expect(extractDynamicParams('', '')).toEqual([]);
    expect(extractDynamicParams('/[param]', '/')).toEqual(['']);
    expect(extractDynamicParams('/static', '/different')).toEqual([]);
  });

  it('should extract catch-all parameters', () => {
    expect(extractDynamicParams('/docs/[...slug]', '/docs/api/auth')).toEqual([
      'api/auth',
    ]);
    expect(
      extractDynamicParams('/posts/[[...slug]]', '/posts/2023/article')
    ).toEqual(['2023/article']);
    expect(extractDynamicParams('/posts/[[...slug]]', '/posts')).toEqual(['']);
  });
});

describe('replaceDynamicSegments', () => {
  it('should replace single dynamic segment', () => {
    expect(replaceDynamicSegments('/blog/123', '/blog/[id]')).toBe('/blog/123');
    expect(replaceDynamicSegments('/user/john-doe', '/user/[username]')).toBe(
      '/user/john-doe'
    );
  });

  it('should replace multiple dynamic segments', () => {
    expect(
      replaceDynamicSegments('/user/456/post/789', '/user/[id]/post/[postId]')
    ).toBe('/user/456/post/789');
    expect(
      replaceDynamicSegments(
        '/en/tech/article-1',
        '/[locale]/[category]/[slug]'
      )
    ).toBe('/en/tech/article-1');
  });

  it('should preserve static segments', () => {
    expect(
      replaceDynamicSegments(
        '/api/users/123/settings',
        '/api/users/[id]/settings'
      )
    ).toBe('/api/users/123/settings');
  });

  it('should return template path when no dynamic segments', () => {
    expect(replaceDynamicSegments('/blog/123', '/about')).toBe('/about');
    expect(replaceDynamicSegments('/any/path', '/static/path')).toBe(
      '/static/path'
    );
  });

  it('should handle insufficient parameters gracefully', () => {
    expect(replaceDynamicSegments('/blog', '/blog/[id]/[slug]')).toBe(
      '/blog/[id]/[slug]'
    );
    expect(replaceDynamicSegments('/one', '/[a]/[b]/[c]')).toBe('/one/[b]/[c]');
  });

  it('should handle catch-all segment formats', () => {
    expect(
      replaceDynamicSegments('/category/tech', '/category/[category]')
    ).toBe('/category/tech');
    expect(replaceDynamicSegments('/docs/api/auth', '/docs/[...slug]')).toBe(
      '/docs/api/auth'
    );
    expect(
      replaceDynamicSegments('/posts/2023/article', '/posts/[[...slug]]')
    ).toBe('/posts/2023/article');
    expect(replaceDynamicSegments('/posts', '/posts/[[...slug]]')).toBe(
      '/posts'
    );
  });
});

describe('getLocalizedPath', () => {
  it('should handle string-based path configuration', () => {
    const pathConfig: PathConfig = {
      '/about': '/about-us',
      '/contact': '/contact-us',
      '/services': '/our-services',
    };

    expect(getLocalizedPath('/about', 'en', pathConfig)).toBe('/en/about-us');
    expect(getLocalizedPath('/contact', 'fr', pathConfig)).toBe(
      '/fr/contact-us'
    );
    expect(getLocalizedPath('/services', 'es', pathConfig)).toBe(
      '/es/our-services'
    );
  });

  it('should handle object-based path configuration', () => {
    const pathConfig: PathConfig = {
      '/about': {
        en: '/about-us',
        fr: '/a-propos',
        es: '/acerca-de',
        de: '/uber-uns',
      },
      '/contact': {
        en: '/contact-us',
        fr: '/contactez-nous',
        es: '/contactanos',
      },
    };

    expect(getLocalizedPath('/about', 'en', pathConfig)).toBe('/en/about-us');
    expect(getLocalizedPath('/about', 'fr', pathConfig)).toBe('/fr/a-propos');
    expect(getLocalizedPath('/about', 'es', pathConfig)).toBe('/es/acerca-de');
    expect(getLocalizedPath('/about', 'de', pathConfig)).toBe('/de/uber-uns');
    expect(getLocalizedPath('/contact', 'en', pathConfig)).toBe(
      '/en/contact-us'
    );
    expect(getLocalizedPath('/contact', 'fr', pathConfig)).toBe(
      '/fr/contactez-nous'
    );
  });

  it('should fallback to shared path when locale not found', () => {
    const pathConfig: PathConfig = {
      '/about': {
        en: '/about-us',
        fr: '/a-propos',
      },
    };

    expect(getLocalizedPath('/about', 'de', pathConfig)).toBe('/de/about');
    expect(getLocalizedPath('/about', 'ja', pathConfig)).toBe('/ja/about');
  });

  it('should return undefined for non-existent shared paths', () => {
    const pathConfig: PathConfig = {
      '/about': '/about-us',
    };

    expect(getLocalizedPath('/nonexistent', 'en', pathConfig)).toBe(undefined);
    expect(getLocalizedPath('/missing', 'fr', pathConfig)).toBe(undefined);
  });

  it('should handle dynamic paths', () => {
    const pathConfig: PathConfig = {
      '/blog/[id]': {
        en: '/blog/[id]',
        fr: '/article/[id]',
      },
      '/user/[id]/profile': '/user/[id]/profile',
    };

    expect(getLocalizedPath('/blog/[id]', 'en', pathConfig)).toBe(
      '/en/blog/[id]'
    );
    expect(getLocalizedPath('/blog/[id]', 'fr', pathConfig)).toBe(
      '/fr/article/[id]'
    );
    expect(getLocalizedPath('/user/[id]/profile', 'es', pathConfig)).toBe(
      '/es/user/[id]/profile'
    );
  });
});

describe('createPathToSharedPathMap', () => {
  it('should create mapping for simple string paths', () => {
    const pathConfig: PathConfig = {
      '/about': '/about-us',
      '/contact': '/contact-us',
      '/services': '/our-services',
    };

    const result = createPathToSharedPathMap(pathConfig, true, 'en');

    expect(getSharedPath('/about', result.pathToSharedPath, undefined)).toBe(
      '/about'
    );
    expect(getSharedPath('/contact', result.pathToSharedPath, undefined)).toBe(
      '/contact'
    );
    expect(getSharedPath('/services', result.pathToSharedPath, undefined)).toBe(
      '/services'
    );
    expect(
      getSharedPath('/about-us', result.defaultLocalePaths, undefined)
    ).toBe(undefined);
  });

  it('should create mapping for object-based paths with locale prefixing', () => {
    const pathConfig: PathConfig = {
      '/about': {
        en: '/about-us',
        fr: '/a-propos',
        es: '/acerca-de',
      },
    };

    const result = createPathToSharedPathMap(pathConfig, true, 'en');

    expect(getSharedPath('/about', result.pathToSharedPath, undefined)).toBe(
      '/about'
    );
    expect(getSharedPath('/en/about-us', result.pathToSharedPath, 'en')).toBe(
      '/about'
    );
    expect(getSharedPath('/fr/a-propos', result.pathToSharedPath, 'fr')).toBe(
      '/about'
    );
    expect(getSharedPath('/es/acerca-de', result.pathToSharedPath, 'es')).toBe(
      '/about'
    );
  });

  it('should handle default locale without prefix', () => {
    const pathConfig: PathConfig = {
      '/about': {
        en: '/about-us',
        fr: '/a-propos',
      },
      '/contact': {
        en: '/contact-us',
        fr: '/contactez-nous',
      },
    };

    const result = createPathToSharedPathMap(pathConfig, false, 'en');

    expect(getSharedPath('/about-us', result.pathToSharedPath, undefined)).toBe(
      '/about'
    );
    expect(
      getSharedPath('/contact-us', result.pathToSharedPath, undefined)
    ).toBe('/contact');
    expect(getSharedPath('/fr/a-propos', result.pathToSharedPath, 'fr')).toBe(
      '/about'
    );
    expect(
      getSharedPath('/fr/contactez-nous', result.pathToSharedPath, 'fr')
    ).toBe('/contact');
    expect(
      getSharedPath('/about-us', result.defaultLocalePaths, undefined)
    ).toBe('/about');
    expect(
      getSharedPath('/contact-us', result.defaultLocalePaths, undefined)
    ).toBe('/contact');
  });

  it('should index dynamic paths', () => {
    const pathConfig: PathConfig = {
      '/blog/[id]': {
        en: '/blog/[id]',
        fr: '/article/[id]',
      },
      '/user/[userId]/post/[postId]': {
        en: '/user/[userId]/post/[postId]',
        fr: '/utilisateur/[userId]/article/[postId]',
      },
    };

    const result = createPathToSharedPathMap(pathConfig, true, 'en');

    expect(getSharedPath('/blog/1', result.pathToSharedPath, undefined)).toBe(
      '/blog/[id]'
    );
    expect(getSharedPath('/en/blog/2', result.pathToSharedPath, 'en')).toBe(
      '/blog/[id]'
    );
    expect(getSharedPath('/fr/article/3', result.pathToSharedPath, 'fr')).toBe(
      '/blog/[id]'
    );
    expect(
      getSharedPath('/user/4/post/5', result.pathToSharedPath, undefined)
    ).toBe('/user/[userId]/post/[postId]');
  });

  it('should handle mixed static and dynamic configurations', () => {
    const pathConfig: PathConfig = {
      '/static-page': '/static-localized',
      '/dynamic/[id]': {
        en: '/dynamic/[id]',
        fr: '/dynamique/[id]',
      },
    };

    const result = createPathToSharedPathMap(pathConfig, true, 'en');

    expect(
      getSharedPath('/static-page', result.pathToSharedPath, undefined)
    ).toBe('/static-page');
    expect(
      getSharedPath('/dynamic/1', result.pathToSharedPath, undefined)
    ).toBe('/dynamic/[id]');
    expect(getSharedPath('/en/dynamic/2', result.pathToSharedPath, 'en')).toBe(
      '/dynamic/[id]'
    );
    expect(
      getSharedPath('/fr/dynamique/3', result.pathToSharedPath, 'fr')
    ).toBe('/dynamic/[id]');
  });
});

describe('getSharedPath', () => {
  const pathToSharedPath = createPathMatcher([
    ['/about', '/about'],
    ['/en/about-us', '/about'],
    ['/fr/a-propos', '/about'],
    ['/es/acerca-de', '/about'],
    ['/blog/[id]', '/blog/[id]'],
    ['/en/blog/[id]', '/blog/[id]'],
    ['/fr/article/[id]', '/blog/[id]'],
    ['/user/[id]/settings', '/user/[id]/settings'],
  ]);

  it('should find exact matches first', () => {
    expect(getSharedPath('/about', pathToSharedPath, undefined)).toBe('/about');
    expect(getSharedPath('/en/about-us', pathToSharedPath, 'en')).toBe(
      '/about'
    );
    expect(getSharedPath('/fr/a-propos', pathToSharedPath, 'fr')).toBe(
      '/about'
    );
  });

  it('should handle locale prefix removal', () => {
    expect(getSharedPath('/fr/a-propos', pathToSharedPath, 'fr')).toBe(
      '/about'
    );
    expect(getSharedPath('/es/acerca-de', pathToSharedPath, 'es')).toBe(
      '/about'
    );
  });

  it('should match dynamic paths with regex', () => {
    expect(getSharedPath('/blog/123', pathToSharedPath, undefined)).toBe(
      '/blog/[id]'
    );
    expect(getSharedPath('/en/blog/456', pathToSharedPath, 'en')).toBe(
      '/blog/[id]'
    );
    expect(getSharedPath('/fr/article/789', pathToSharedPath, 'fr')).toBe(
      '/blog/[id]'
    );
    expect(
      getSharedPath('/user/john/settings', pathToSharedPath, undefined)
    ).toBe('/user/[id]/settings');
  });

  it('treats regex metacharacters as literal path content', () => {
    const pathMatcher = createPathMatcher([
      ['/files/v1.0/[id]', '/files/[version]/[id]'],
      ['/language/c++/[slug]', '/language/[slug]'],
    ]);

    expect(getSharedPath('/files/v1.0/report', pathMatcher, undefined)).toBe(
      '/files/[version]/[id]'
    );
    expect(getSharedPath('/files/v1x0/report', pathMatcher, undefined)).toBe(
      undefined
    );
    expect(getSharedPath('/language/c++/guide', pathMatcher, undefined)).toBe(
      '/language/[slug]'
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

  it('prioritizes static, dynamic, and catch-all paths', () => {
    const pathMatcher = createPathMatcher([
      ['/docs/[...slug]', '/docs/[...slug]'],
      ['/docs/[section]', '/docs/[section]'],
      ['/docs/getting-started', '/docs/getting-started'],
    ]);

    expect(getSharedPath('/docs/getting-started', pathMatcher, undefined)).toBe(
      '/docs/getting-started'
    );
    expect(getSharedPath('/docs/api', pathMatcher, undefined)).toBe(
      '/docs/[section]'
    );
    expect(getSharedPath('/docs/api/auth', pathMatcher, undefined)).toBe(
      '/docs/[...slug]'
    );
  });

  it('should return undefined for no matches', () => {
    expect(getSharedPath('/nonexistent', pathToSharedPath, undefined)).toBe(
      undefined
    );
    expect(getSharedPath('/en/nonexistent', pathToSharedPath, 'en')).toBe(
      undefined
    );
    expect(
      getSharedPath('/completely/different/path', pathToSharedPath, 'fr')
    ).toBe(undefined);
  });

  it('should prioritize exact matches over regex matches', () => {
    const pathMatcher = createPathMatcher([
      ['/about', '/about'],
      ['/[slug]', '/dynamic'],
    ]);
    expect(getSharedPath('/about', pathMatcher, undefined)).toBe('/about');
  });

  it('should handle edge cases', () => {
    expect(getSharedPath('/', pathToSharedPath, undefined)).toBe(undefined);
    expect(getSharedPath('', pathToSharedPath, undefined)).toBe(undefined);
    expect(getSharedPath('/en/', pathToSharedPath, 'en')).toBe(undefined);
  });
});
