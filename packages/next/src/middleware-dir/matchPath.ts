import {
  getPathSegments,
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
  if (segmentIndex === pathSegments.length) {
    if (node.match !== undefined) return node.match;
    if (node.optionalCatchAllSegment) {
      return matchPathSegments(
        node.optionalCatchAllSegment,
        pathSegments,
        segmentIndex
      );
    }
    return undefined;
  }

  const segment = pathSegments[segmentIndex];
  const staticNode = node.staticSegments.get(segment);
  if (staticNode) {
    const match = matchPathSegments(staticNode, pathSegments, segmentIndex + 1);
    if (match !== undefined) return match;
  }

  if (segment && node.dynamicSegment) {
    const match = matchPathSegments(
      node.dynamicSegment,
      pathSegments,
      segmentIndex + 1
    );
    if (match !== undefined) return match;
  }

  if (node.catchAllSegment) {
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

  if (node.optionalCatchAllSegment) {
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
  return matchPathSegments(matcher.root, getPathSegments(pathname), 0);
}

/** Gets the shared route and source template matching a concrete pathname. */
export function getSharedPath(
  standardizedPathname: string,
  pathToSharedPath: PathMatcher,
  pathnameLocale: string | undefined
): SharedPathMatch | undefined {
  const directMatch = matchPath(standardizedPathname, pathToSharedPath);
  if (directMatch !== undefined) {
    return { ...directMatch, matchedPathname: standardizedPathname };
  }

  if (pathnameLocale) {
    const pathnameWithoutLocale = standardizedPathname.replace(/^\/[^/]+/, '');
    const unprefixedMatch = matchPath(pathnameWithoutLocale, pathToSharedPath);
    if (unprefixedMatch !== undefined) {
      return { ...unprefixedMatch, matchedPathname: pathnameWithoutLocale };
    }
  }
  return undefined;
}
