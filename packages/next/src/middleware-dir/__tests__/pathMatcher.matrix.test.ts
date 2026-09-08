import { describe, expect, it } from 'vitest';
import { createPathMatcher, getSharedPath } from '../utils';

const NAMESPACE_COUNT = 32;

type MatchCase = {
  expectedSharedPath: string;
  expectedTemplate: string;
  label: string;
  pathname: string;
};

const pathEntries: Array<readonly [string, string]> = [];
const matchCases: MatchCase[] = [];

function addMatchCase(
  label: string,
  pathname: string,
  expectedTemplate: string,
  expectedSharedPath: string
) {
  matchCases.push({
    expectedSharedPath,
    expectedTemplate,
    label,
    pathname,
  });
}

for (let index = 1; index <= NAMESPACE_COUNT; index += 1) {
  const namespace = `/tenant-${index}`;
  const staticTemplate = `${namespace}/docs/fixed`;
  const dynamicTemplate = `${namespace}/docs/[section]`;
  const catchAllTemplate = `${namespace}/docs/[...slug]`;
  const optionalCatchAllTemplate = `${namespace}/updates/[[...slug]]`;
  const multipleDynamicTemplate = `${namespace}/accounts/[accountId]/cards/[cardId]`;
  const unicodeTemplate = `${namespace}/café/[slug]`;

  pathEntries.push(
    [staticTemplate, `${namespace}/shared/static`],
    [dynamicTemplate, `${namespace}/shared/dynamic`],
    [catchAllTemplate, `${namespace}/shared/catch-all`],
    [optionalCatchAllTemplate, `${namespace}/shared/optional-catch-all`],
    [multipleDynamicTemplate, `${namespace}/shared/multiple-dynamic`],
    [unicodeTemplate, `${namespace}/shared/unicode`]
  );

  addMatchCase(
    `namespace ${index} prefers a static route`,
    `${namespace}/docs/fixed${index % 2 === 0 ? '/' : ''}`,
    staticTemplate,
    `${namespace}/shared/static`
  );
  addMatchCase(
    `namespace ${index} falls back to a dynamic route`,
    `${namespace}/docs/api-${index}${index % 2 === 1 ? '/' : ''}`,
    dynamicTemplate,
    `${namespace}/shared/dynamic`
  );
  addMatchCase(
    `namespace ${index} falls back to a required catch-all route`,
    `${namespace}/docs/api/auth/version-${index}${index % 2 === 0 ? '/' : ''}`,
    catchAllTemplate,
    `${namespace}/shared/catch-all`
  );
  addMatchCase(
    `namespace ${index} matches an empty optional catch-all route`,
    `${namespace}/updates${index % 2 === 1 ? '/' : ''}`,
    optionalCatchAllTemplate,
    `${namespace}/shared/optional-catch-all`
  );
  addMatchCase(
    `namespace ${index} matches a populated optional catch-all route`,
    `${namespace}/updates/world/latest/story-${index}${
      index % 2 === 0 ? '/' : ''
    }`,
    optionalCatchAllTemplate,
    `${namespace}/shared/optional-catch-all`
  );
  addMatchCase(
    `namespace ${index} matches multiple dynamic segments`,
    `${namespace}/accounts/account-${index}/cards/card-${index}${
      index % 2 === 1 ? '/' : ''
    }`,
    multipleDynamicTemplate,
    `${namespace}/shared/multiple-dynamic`
  );
  addMatchCase(
    `namespace ${index} normalizes encoded Unicode`,
    `${namespace}/${index % 2 === 0 ? 'caf%C3%A9' : 'café'}/article-${index}`,
    unicodeTemplate,
    `${namespace}/shared/unicode`
  );
}

describe('path matcher matrix', () => {
  const matcher = createPathMatcher(pathEntries);

  it.each(matchCases)('$label', (testCase) => {
    expect(getSharedPath(testCase.pathname, matcher, undefined)).toEqual({
      matchedPathname: testCase.pathname,
      pathTemplate: testCase.expectedTemplate,
      sharedPath: testCase.expectedSharedPath,
    });
  });
});

describe('path matcher edge cases', () => {
  const safeMatcher = createPathMatcher([['/safe/[slug]', '/safe/[slug]']]);
  const malformedPaths = [
    '/%',
    '/%0',
    '/%1G',
    '/%GG',
    '/%C3',
    '/%E0%A4%A',
    '/safe/%',
    '/safe/%0',
    '/safe/%2G',
    '/safe/%C3',
    '/safe/%E0%A4%A',
    '/safe/value%',
    '/safe/value%0',
    '/safe/value%GG',
    '/safe/%F0%28%8C%28',
    '/safe/%ED%A0%80',
  ];

  it.each(malformedPaths)(
    'does not throw for malformed pathname %s',
    (path) => {
      expect(() => getSharedPath(path, safeMatcher, undefined)).not.toThrow();
    }
  );

  it('lets the later dynamic route win when parameter names share a shape', () => {
    const matcher = createPathMatcher([
      ['/products/[firstId]', '/first'],
      ['/products/[secondId]', '/second'],
    ]);

    expect(getSharedPath('/products/card', matcher, undefined)).toMatchObject({
      pathTemplate: '/products/[secondId]',
      sharedPath: '/second',
    });
  });

  it('lets the later required catch-all route win when names share a shape', () => {
    const matcher = createPathMatcher([
      ['/docs/[...firstSlug]', '/first'],
      ['/docs/[...secondSlug]', '/second'],
    ]);

    expect(
      getSharedPath('/docs/guides/start', matcher, undefined)
    ).toMatchObject({
      pathTemplate: '/docs/[...secondSlug]',
      sharedPath: '/second',
    });
  });

  it('lets the later optional catch-all route win when names share a shape', () => {
    const matcher = createPathMatcher([
      ['/news/[[...firstSlug]]', '/first'],
      ['/news/[[...secondSlug]]', '/second'],
    ]);

    expect(getSharedPath('/news', matcher, undefined)).toMatchObject({
      pathTemplate: '/news/[[...secondSlug]]',
      sharedPath: '/second',
    });
  });

  it('accepts matcher inputs without a leading slash', () => {
    const matcher = createPathMatcher([['docs/[slug]', '/docs/[slug]']]);

    expect(getSharedPath('docs/guide', matcher, undefined)).toMatchObject({
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
      getSharedPath('/docs/fixed/reference', matcher, undefined)
    ).toMatchObject({
      pathTemplate: '/docs/[section]/reference',
      sharedPath: '/dynamic',
    });
  });
});
