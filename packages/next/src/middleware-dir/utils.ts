import { NextRequest, NextResponse } from 'next/server';
import { standardizeLocale } from '@generaltranslation/format';
import { GTRuntime } from 'generaltranslation/runtime';
import { NextURL } from 'next/dist/server/web/next-url';
import { parseAcceptLanguage } from 'gt-i18n/internal';
import {
  createPathMatcher,
  createPathToSharedPathMap,
  getDynamicSegmentType,
  normalizePathname,
  type PathConfig,
  type PathMatcher,
} from './createPathMatcher';
import { getSharedPath, getSharedPathMatch } from './matchPath';

export {
  createPathMatcher,
  createPathToSharedPathMap,
  getSharedPath,
  getSharedPathMatch,
  normalizePathname,
};
export type { PathConfig, PathMatcher };

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

function applyBasePath(responseUrl: URL, originalUrl: NextURL) {
  const { basePath } = originalUrl;
  if (
    !basePath ||
    responseUrl.origin !== originalUrl.origin ||
    responseUrl.pathname === basePath ||
    responseUrl.pathname.startsWith(`${basePath}/`)
  ) {
    return;
  }
  responseUrl.pathname = `${basePath}${responseUrl.pathname}`;
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
    applyBasePath(responseUrl, originalUrl);
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
  templatePath: string,
  sourceTemplatePath = templatePath
): string {
  if (!templatePath.includes('[')) {
    return applyTrailingSlash(path, templatePath);
  }

  const params = extractDynamicParams(sourceTemplatePath, path);
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
 * Checks whether a pathname matches an unprefixed default-locale path.
 */
function inDefaultLocalePaths(
  pathname: string,
  defaultLocalePaths: PathMatcher
): boolean {
  return getSharedPath(pathname, defaultLocalePaths, undefined) !== undefined;
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
