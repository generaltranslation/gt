export type PathConfig = {
  [key: string]: string | { [key: string]: string };
};

export type PathMatch = {
  pathTemplate: string;
  sharedPath: string;
};

export type PathMatcherNode = {
  staticSegments: Map<string, PathMatcherNode>;
  dynamicSegment?: PathMatcherNode;
  catchAllSegment?: PathMatcherNode;
  optionalCatchAllSegment?: PathMatcherNode;
  match?: PathMatch;
};

export type PathMatcher = {
  root: PathMatcherNode;
  localizedRoot?: PathMatcherNode;
  defaultLocaleRoot?: PathMatcherNode;
};

export type DynamicSegmentType = 'dynamic' | 'catch-all' | 'optional-catch-all';

const DYNAMIC_SEGMENT_PATTERN = /^\[[^.[\]/][^\]/]*\]$/;
const CATCH_ALL_SEGMENT_PATTERN = /^\[\.\.\.[^\]/]+\]$/;
const OPTIONAL_CATCH_ALL_SEGMENT_PATTERN = /^\[\[\.\.\.[^\]/]+\]\]$/;

/** Creates an empty node in the pathname matcher trie. */
function createPathMatcherNode(): PathMatcherNode {
  return { staticSegments: new Map() };
}

/** Identifies the supported Next.js dynamic segment syntax. */
export function getDynamicSegmentType(
  segment: string
): DynamicSegmentType | undefined {
  if (OPTIONAL_CATCH_ALL_SEGMENT_PATTERN.test(segment)) {
    return 'optional-catch-all';
  }
  if (CATCH_ALL_SEGMENT_PATTERN.test(segment)) return 'catch-all';
  if (DYNAMIC_SEGMENT_PATTERN.test(segment)) return 'dynamic';
  return undefined;
}

/** Decodes and NFC-normalizes a pathname before matching it. */
export function normalizePathname(pathname: string): string {
  let normalizedPathname = pathname;
  try {
    normalizedPathname = decodeURI(pathname);
  } catch {
    // Leave malformed escape sequences untouched so they simply do not match.
  }
  return normalizedPathname.normalize('NFC');
}

/** Splits a pathname without interpreting encoded literals as route syntax. */
export function getPathSegments(pathname: string): string[] {
  if (pathname === '') return [];
  const normalizedPathname = pathname;
  const pathnameWithoutLeadingSlash = normalizedPathname.startsWith('/')
    ? normalizedPathname.slice(1)
    : normalizedPathname;
  return pathnameWithoutLeadingSlash.split('/');
}

/** Inserts a pathname template and its shared path into the matcher trie. */
function insertPath(
  matcher: PathMatcher,
  pathname: string,
  sharedPath: string
) {
  let node = matcher.root;

  for (const segment of getPathSegments(pathname)) {
    const segmentType = getDynamicSegmentType(segment);
    if (segmentType === 'dynamic') {
      node.dynamicSegment ||= createPathMatcherNode();
      node = node.dynamicSegment;
    } else if (segmentType === 'catch-all') {
      node.catchAllSegment ||= createPathMatcherNode();
      node = node.catchAllSegment;
    } else if (segmentType === 'optional-catch-all') {
      node.optionalCatchAllSegment ||= createPathMatcherNode();
      node = node.optionalCatchAllSegment;
    } else {
      const staticSegment = normalizePathname(segment);
      const staticNode =
        node.staticSegments.get(staticSegment) || createPathMatcherNode();
      node.staticSegments.set(staticSegment, staticNode);
      node = staticNode;
    }
  }

  // Match the previous map behavior when two parameter names describe the
  // same path shape: the later entry wins.
  node.match = { pathTemplate: pathname, sharedPath };
}

/** Builds a segment trie from pathname-to-shared-path entries. */
export function createPathMatcher(
  pathEntries: ReadonlyArray<readonly [string, string]>
): PathMatcher {
  const matcher: PathMatcher = { root: createPathMatcherNode() };
  for (const [pathname, sharedPath] of pathEntries) {
    insertPath(matcher, pathname, sharedPath);
  }
  return matcher;
}

/** Creates matchers for localized paths and unprefixed default-locale paths. */
export function createPathToSharedPathMap(
  pathConfig: PathConfig,
  prefixDefaultLocale: boolean,
  defaultLocale: string
): {
  pathToSharedPath: PathMatcher;
  defaultLocalePaths: PathMatcher;
} {
  const pathEntries: Array<readonly [string, string]> = [];
  const localizedEntries: Array<readonly [string, string]> = [];
  const defaultLocaleEntries: Array<readonly [string, string]> = [];

  for (const [sharedPath, localizedPaths] of Object.entries(pathConfig)) {
    pathEntries.push([sharedPath, sharedPath]);

    if (typeof localizedPaths === 'object') {
      for (const [locale, localizedPath] of Object.entries(localizedPaths)) {
        localizedEntries.push([`/${locale}${localizedPath}`, sharedPath]);
        if (!prefixDefaultLocale && locale === defaultLocale) {
          defaultLocaleEntries.push([localizedPath, sharedPath]);
        }
      }
    }
  }

  const defaultLocalePaths = createPathMatcher(defaultLocaleEntries);
  return {
    pathToSharedPath: {
      ...createPathMatcher(pathEntries),
      localizedRoot: createPathMatcher(localizedEntries).root,
      defaultLocaleRoot: defaultLocalePaths.root,
    },
    defaultLocalePaths,
  };
}
