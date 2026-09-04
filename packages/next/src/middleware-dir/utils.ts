import { NextRequest, NextResponse } from 'next/server';
import { standardizeLocale } from '@generaltranslation/format';
import { GTRuntime } from 'generaltranslation/runtime';
import { NextURL } from 'next/dist/server/web/next-url';
import { parseAcceptLanguage } from 'gt-i18n/internal';

export type PathConfig = {
  [key: string]: string | { [key: string]: string };
};

export type ResponseConfig = {
  type: 'next' | 'rewrite' | 'redirect';
  responsePath?: string;
  originalUrl: NextURL;
  userLocale: string;
  clearResetCookie: boolean;
  headerList: Headers;
  localeRouting: boolean;
  localeRoutingEnabledCookieName: string;
  resetLocaleCookieName: string;
  localeHeaderName: string;
};

type PathMatcherNode = {
  staticSegments: Map<string, PathMatcherNode>;
  dynamicSegment?: PathMatcherNode;
  catchAllSegment?: PathMatcherNode;
  optionalCatchAllSegment?: PathMatcherNode;
  sharedPath?: string;
};

export type PathMatcher = {
  root: PathMatcherNode;
};

type DynamicSegmentType = 'dynamic' | 'catch-all' | 'optional-catch-all';

const DYNAMIC_SEGMENT_PATTERN = /^\[[^.[\]/]+\]$/;
const CATCH_ALL_SEGMENT_PATTERN = /^\[\.\.\.[^\][\]/]+\]$/;
const OPTIONAL_CATCH_ALL_SEGMENT_PATTERN = /^\[\[\.\.\.[^\][\]/]+\]\]$/;

/** Creates an empty node in the pathname matcher trie. */
function createPathMatcherNode(): PathMatcherNode {
  return { staticSegments: new Map() };
}

/** Identifies the supported Next.js dynamic segment syntax. */
function getDynamicSegmentType(
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

/** Splits a pathname into the segments consumed by the matcher. */
function getPathSegments(pathname: string): string[] {
  if (pathname === '') return [];
  let normalizedPathname = normalizePathname(pathname);
  if (normalizedPathname.length > 1) {
    normalizedPathname = normalizedPathname.replace(/\/+$/, '') || '/';
  }

  const pathnameWithoutLeadingSlash = normalizedPathname.startsWith('/')
    ? normalizedPathname.slice(1)
    : normalizedPathname;
  return pathnameWithoutLeadingSlash.split('/');
}

/** Applies the request pathname's trailing-slash style to a target path. */
function applyTrailingSlash(pathname: string, targetPathname: string): string {
  const sourceHasTrailingSlash = pathname.length > 1 && pathname.endsWith('/');
  if (sourceHasTrailingSlash) {
    return targetPathname === '/' || targetPathname.endsWith('/')
      ? targetPathname
      : `${targetPathname}/`;
  }
  return targetPathname.length > 1
    ? targetPathname.replace(/\/+$/, '') || '/'
    : targetPathname;
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
      const staticNode =
        node.staticSegments.get(segment) || createPathMatcherNode();
      node.staticSegments.set(segment, staticNode);
      node = staticNode;
    }
  }

  // Match the previous map behavior when two parameter names describe the
  // same path shape: the later entry wins.
  node.sharedPath = sharedPath;
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

/** Recursively matches segments in static, dynamic, then catch-all order. */
function matchPathSegments(
  node: PathMatcherNode,
  pathSegments: string[],
  segmentIndex: number
): string | undefined {
  if (segmentIndex === pathSegments.length) {
    if (node.sharedPath !== undefined) return node.sharedPath;
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

/** Looks up the shared path associated with a concrete pathname. */
function matchPath(pathname: string, matcher: PathMatcher) {
  return matchPathSegments(matcher.root, getPathSegments(pathname), 0);
}

/** Creates a middleware response and attaches GT routing state. */
export function getResponse({
  type,
  originalUrl,
  responsePath = originalUrl.pathname,
  userLocale,
  clearResetCookie,
  headerList,
  localeRouting,
  localeRoutingEnabledCookieName,
  resetLocaleCookieName,
  localeHeaderName,
}: ResponseConfig): NextResponse<unknown> {
  // Get Response
  let response;
  if (type === 'next') {
    response = NextResponse.next({
      request: {
        headers: headerList,
      },
    });
  } else {
    const responseUrl = new URL(responsePath, originalUrl);
    responseUrl.search = originalUrl.search;
    response =
      type === 'rewrite'
        ? NextResponse.rewrite(responseUrl, {
            request: {
              headers: headerList,
            },
          })
        : NextResponse.redirect(responseUrl);
  }

  // Set Headers & Cookies
  response.headers.set(localeHeaderName, userLocale);
  response.cookies.set(
    localeRoutingEnabledCookieName,
    localeRouting.toString()
  );
  // Clear the setLocale reset cookie once it has been processed. The locale
  // cookie must be kept: the client re-reads it on every render, and deleting
  // it here races with concurrent prefetch responses after a locale switch,
  // dropping client components back to the browser's default locale.
  if (clearResetCookie && type !== 'redirect') {
    response.cookies.delete(resetLocaleCookieName);
  }
  return response;
}

/**
 * Extracts the locale from the given pathname.
 */
export function extractLocale(pathname: string): string | null {
  const matches = pathname.match(/^\/([^/]+)(?:\/|$)/);
  return matches ? matches[1] : null;
}

/**
 * Extracts dynamic parameters from a path based on a shared path pattern.
 */
export function extractDynamicParams(
  templatePath: string,
  path: string
): string[] {
  if (!templatePath.includes('[')) return [];

  const params: string[] = [];
  const pathSegments = path.split('/');
  const sharedSegments = templatePath.split('/');

  sharedSegments.forEach((segment, index) => {
    const segmentType = getDynamicSegmentType(segment);
    if (segmentType === 'catch-all' || segmentType === 'optional-catch-all') {
      params.push(pathSegments.slice(index).join('/'));
    } else if (segmentType === 'dynamic') {
      params.push(pathSegments[index]);
    }
  });

  return params;
}

/**
 * Replaces dynamic segments in a path with their actual values.
 */
export function replaceDynamicSegments(
  path: string,
  templatePath: string
): string {
  if (!templatePath.includes('[')) {
    return applyTrailingSlash(path, templatePath);
  }

  const params = extractDynamicParams(templatePath, path);
  let paramIndex = 0;
  const resultSegments: string[] = [];

  for (const segment of templatePath.split('/')) {
    const segmentType = getDynamicSegmentType(segment);
    if (!segmentType) {
      resultSegments.push(segment);
      continue;
    }

    const param = params[paramIndex++];
    if (segmentType === 'optional-catch-all' && !param) continue;
    if (!param) {
      resultSegments.push(segment);
      continue;
    }
    if (segmentType === 'catch-all' || segmentType === 'optional-catch-all') {
      resultSegments.push(...param.split('/'));
    } else {
      resultSegments.push(param);
    }
  }

  return applyTrailingSlash(path, resultSegments.join('/') || '/');
}

/**
 * Gets the full localized path given a shared path and locale.
 */
export function getLocalizedPath(
  sharedPath: string,
  locale: string,
  pathConfig: PathConfig
): string | undefined {
  const localizedPath = pathConfig[sharedPath];
  let path: string | undefined;

  if (typeof localizedPath === 'string') {
    path = `/${locale}${localizedPath}`;
  } else if (typeof localizedPath === 'object') {
    path = localizedPath[locale]
      ? `/${locale}${localizedPath[locale]}`
      : `/${locale}${sharedPath}`;
  }

  return path;
}

/**
 * Creates matchers for localized paths and unprefixed default-locale paths.
 */
export function createPathToSharedPathMap(
  pathConfig: PathConfig,
  prefixDefaultLocale: boolean,
  defaultLocale: string
): {
  pathToSharedPath: PathMatcher;
  defaultLocalePaths: PathMatcher;
} {
  const pathEntries: Array<readonly [string, string]> = [];
  const defaultLocaleEntries: Array<readonly [string, string]> = [];

  for (const [sharedPath, localizedPaths] of Object.entries(pathConfig)) {
    pathEntries.push([sharedPath, sharedPath]);

    if (typeof localizedPaths === 'object') {
      for (const [locale, localizedPath] of Object.entries(localizedPaths)) {
        pathEntries.push([`/${locale}${localizedPath}`, sharedPath]);
        if (!prefixDefaultLocale && locale === defaultLocale) {
          pathEntries.push([localizedPath, sharedPath]);
          defaultLocaleEntries.push([localizedPath, sharedPath]);
        }
      }
    }
  }

  return {
    pathToSharedPath: createPathMatcher(pathEntries),
    defaultLocalePaths: createPathMatcher(defaultLocaleEntries),
  };
}

/**
 * Gets the shared path matching a localized or unprefixed pathname.
 */
export function getSharedPath(
  standardizedPathname: string,
  pathToSharedPath: PathMatcher,
  pathnameLocale: string | undefined
): string | undefined {
  const sharedPath = matchPath(standardizedPathname, pathToSharedPath);
  if (sharedPath !== undefined) return sharedPath;

  if (pathnameLocale) {
    const pathnameWithoutLocale = standardizedPathname.replace(/^\/[^/]+/, '');
    return matchPath(pathnameWithoutLocale, pathToSharedPath);
  }
  return undefined;
}

/**
 * Checks whether a pathname matches an unprefixed default-locale path.
 */
function inDefaultLocalePaths(
  pathname: string,
  defaultLocalePaths: PathMatcher
): boolean {
  return matchPath(pathname, defaultLocalePaths) !== undefined;
}

/**
 * Resolves the request locale from its pathname, cookies, and headers.
 */
export function getLocaleFromRequest(
  req: NextRequest,
  defaultLocale: string,
  approvedLocales: string[],
  localeRouting: boolean,
  gtServicesEnabled: boolean,
  prefixDefaultLocale: boolean,
  defaultLocalePaths: PathMatcher,
  referrerLocaleCookieName: string,
  localeCookieName: string,
  resetLocaleCookieName: string,
  gt: GTRuntime
): {
  userLocale: string;
  pathnameLocale: string | undefined;
  unstandardizedPathnameLocale: string | null | undefined;
  clearResetCookie: boolean;
} {
  const headerList = new Headers(req.headers);
  const candidates: string[] = [];
  let clearResetCookie = false;
  const { pathname } = req.nextUrl;

  // Check pathname locales
  let pathnameLocale, unstandardizedPathnameLocale;
  if (localeRouting) {
    unstandardizedPathnameLocale = extractLocale(pathname);
    const extractedLocale = gtServicesEnabled
      ? standardizeLocale(unstandardizedPathnameLocale || '')
      : unstandardizedPathnameLocale;

    if (
      extractedLocale &&
      gt.isValidLocale(extractedLocale) &&
      gt.determineLocale([extractedLocale], approvedLocales)
    ) {
      const determinedLocale = gt.determineLocale(
        [extractedLocale],
        approvedLocales
      );
      if (determinedLocale) {
        pathnameLocale = gt.resolveAliasLocale(determinedLocale);
        candidates.push(pathnameLocale);
      }
    }
  }

  // Check pathname for a customized unprefixed default locale path (e.g. /en-about , /en-dashboard/1/en-custom)
  if (
    localeRouting &&
    !prefixDefaultLocale &&
    !pathnameLocale &&
    inDefaultLocalePaths(pathname, defaultLocalePaths)
  ) {
    candidates.push(defaultLocale); // will override other candidates
  }

  // Check cookie locale
  const cookieLocale = req.cookies.get(localeCookieName);
  if (cookieLocale?.value && gt.isValidLocale(cookieLocale?.value)) {
    const resetCookie = req.cookies.get(resetLocaleCookieName);
    if (resetCookie?.value) {
      // Add this back in when we support custom getLocale
      // addedCustomLocale
      //   ? candidates.splice(1, 0, cookieLocale.value)
      //   : candidates.unshift(cookieLocale.value);
      candidates.unshift(cookieLocale.value);
      clearResetCookie = true;
    } else {
      candidates.push(cookieLocale.value);
    }
  }

  // Check referrer locale
  const referrerLocaleCookie = req.cookies.get(referrerLocaleCookieName);
  if (
    referrerLocaleCookie?.value &&
    gt.isValidLocale(referrerLocaleCookie.value) &&
    !clearResetCookie
  ) {
    const referrerLocale = referrerLocaleCookie.value;
    if (gt.determineLocale([referrerLocale], approvedLocales)) {
      candidates.push(referrerLocale);
    }
  }

  // Get locales from accept-language header
  if (process.env._GENERALTRANSLATION_IGNORE_BROWSER_LOCALES === 'false') {
    candidates.push(...parseAcceptLanguage(headerList.get('accept-language')));
  }

  // Get default locale
  candidates.push(defaultLocale);

  // determine userLocale
  const unstandardizedUserLocale =
    gt.determineLocale(
      candidates.filter((locale) => gt.isValidLocale(locale)),
      approvedLocales
    ) || defaultLocale;
  const userLocale = gtServicesEnabled
    ? standardizeLocale(unstandardizedUserLocale)
    : unstandardizedUserLocale;

  return {
    userLocale,
    pathnameLocale,
    unstandardizedPathnameLocale,
    clearResetCookie,
  };
}
