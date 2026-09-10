import {
  getDynamicSegmentType,
  getPathSegments,
  normalizePathname,
  type PathMatch,
  type PathMatcher,
  type PathMatcherNode,
} from './createPathMatcher';

export type SharedPathMatch = PathMatch & {
  matchedPathname: string;
};

/** Recursively matches segments in static, dynamic, then catch-all order. */
function matchPathSegments(
  node: PathMatcherNode,
  pathSegments: string[],
  segmentIndex: number
): PathMatch | undefined {
  // Base case: we're at the end of the segments
  if (segmentIndex === pathSegments.length) {
    if (node.match !== undefined) return node.match;
    // Recursive case 4: edge case - see below
    if (node.optionalCatchAllSegment) {
      return matchPathSegments(
        node.optionalCatchAllSegment,
        pathSegments,
        segmentIndex
      );
    }
    return undefined;
  }

  // Get the segment at the current index
  const segment = pathSegments[segmentIndex];

  // Recursive case 1: match a static segment
  const staticNode = node.staticSegments.get(segment);
  if (staticNode) {
    const match = matchPathSegments(staticNode, pathSegments, segmentIndex + 1);
    if (match !== undefined) return match;
  }

  // Recursive case 2: match a dynamic segement
  if (segment && node.dynamicSegment) {
    const match = matchPathSegments(
      node.dynamicSegment,
      pathSegments,
      segmentIndex + 1
    );
    if (match !== undefined) return match;
  }

  // Recursive case 3: match a catch-all segment
  if (node.catchAllSegment) {
    /**
     * Technically, this loop isn't necessary. This would handle cases
     * where we have static segments after the catch-all segment. Which
     * does not occur in Next.js routing. (`/docs/[...slug]/authors`)
     *
     * That means this loop only iterates once for a catch-all segment,
     * so costs only scale linearlly which is acceptable.
     */
    for (
      let nextSegmentIndex = pathSegments.length;
      nextSegmentIndex > segmentIndex;
      nextSegmentIndex--
    ) {
      if (
        !pathSegments
          .slice(segmentIndex, nextSegmentIndex)
          .some((segment) => segment.length > 0)
      ) {
        continue;
      }
      const match = matchPathSegments(
        node.catchAllSegment,
        pathSegments,
        nextSegmentIndex
      );
      if (match !== undefined) return match;
    }
  }

  // Recursive case 4: match an optional catch-all segment
  if (node.optionalCatchAllSegment) {
    /**
     * See note in recursive case 3.
     */
    for (
      let nextSegmentIndex = pathSegments.length;
      nextSegmentIndex >= segmentIndex;
      nextSegmentIndex--
    ) {
      const match = matchPathSegments(
        node.optionalCatchAllSegment,
        pathSegments,
        nextSegmentIndex
      );
      if (match !== undefined) return match;
    }
  }

  return undefined;
}

/** Looks up the route entry associated with a concrete pathname. */
function matchPath(pathname: string, matcher: PathMatcher) {
  return matchPathSegments(
    matcher.root,
    getPathSegments(pathname).map(normalizePathname),
    0
  );
}

/** Ranks route segments in the same order as trie traversal. */
function segmentPriority(segment: string | undefined): number {
  if (segment === undefined) return -1;
  switch (getDynamicSegmentType(segment)) {
    case 'dynamic':
      return 1;
    case 'catch-all':
      return 2;
    case 'optional-catch-all':
      return 3;
    default:
      return 0;
  }
}

/** Compares shared and localized candidates without counting the locale prefix. */
function isSharedMoreSpecific(
  shared: PathMatch,
  localized: PathMatch,
  pathnameLocale: string | undefined
): boolean {
  const sharedSegments = getPathSegments(shared.pathTemplate);
  const localizedSegments = getPathSegments(localized.pathTemplate);
  if (pathnameLocale) localizedSegments.shift();
  for (
    let index = 0;
    index < Math.max(sharedSegments.length, localizedSegments.length);
    index++
  ) {
    const difference =
      segmentPriority(sharedSegments[index]) -
      segmentPriority(localizedSegments[index]);
    if (difference !== 0) return difference < 0;
  }
  return false;
}

/** Gets the shared route and source template matching a concrete pathname. */
export function getSharedPath(
  standardizedPathname: string,
  pathToSharedPath: PathMatcher,
  pathnameLocale: string | undefined
): SharedPathMatch | undefined {
  if (pathToSharedPath.localizedRoot) {
    // Is this a "shared path" (e.g. `/home`)?
    const pathnameWithoutLocale = pathnameLocale
      ? standardizedPathname.replace(/^\/[^/]+/, '') || '/'
      : standardizedPathname;
    const sharedMatch = matchPath(pathnameWithoutLocale, pathToSharedPath);

    // Is this a "localized path" (e.g. `/inicio`)?
    const localizedRoot = pathnameLocale
      ? pathToSharedPath.localizedRoot
      : pathToSharedPath.defaultLocaleRoot;
    const localizedMatch = localizedRoot
      ? matchPath(standardizedPathname, { root: localizedRoot })
      : undefined;

    if (
      sharedMatch &&
      (!localizedMatch ||
        isSharedMoreSpecific(sharedMatch, localizedMatch, pathnameLocale))
    ) {
      return { ...sharedMatch, matchedPathname: pathnameWithoutLocale };
    }
    if (localizedMatch) {
      return { ...localizedMatch, matchedPathname: standardizedPathname };
    }
    return undefined;
  }

  const directMatch = matchPath(standardizedPathname, pathToSharedPath);
  if (directMatch !== undefined) {
    return { ...directMatch, matchedPathname: standardizedPathname };
  }

  if (pathnameLocale) {
    const pathnameWithoutLocale =
      standardizedPathname.replace(/^\/[^/]+/, '') || '/';
    const unprefixedMatch = matchPath(pathnameWithoutLocale, pathToSharedPath);
    if (unprefixedMatch !== undefined) {
      return { ...unprefixedMatch, matchedPathname: pathnameWithoutLocale };
    }
  }
  return undefined;
}
