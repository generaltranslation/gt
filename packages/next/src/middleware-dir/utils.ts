import { NextRequest, NextResponse } from 'next/server';
import { standardizeLocale } from '@generaltranslation/format';
import { GTRuntime } from 'generaltranslation/runtime';
import { NextURL } from 'next/dist/server/web/next-url';
import { parseAcceptLanguage } from 'gt-i18n/internal';
import {
  applyTrailingSlash,
  normalizePathname,
  stripTrailingSlashes,
} from './pathname';

export { normalizePathname };

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

const DYNAMIC_PATH_SEGMENT_PATTERN = '/[^/]+';
/** Normalizes each segment once without decoding encoded separators. */
function normalizePathForMatching(pathname: string): string {
  return pathname.split('/').map(normalizePathname).join('/');
}

/** Classifies placeholders before decoding static path content. */
function createPathPattern(pathname: string): string {
  pathname = stripTrailingSlashes(pathname);
  if (!/\[([^\]]+)\]/.test(pathname)) {
    return normalizePathForMatching(pathname);
  }
  return pathname
    .split(/(\[[^\]]+\])/)
    .map((part, index) =>
      index % 2
        ? '[^/]+'
        : normalizePathForMatching(part).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    )
    .join('');
}

function applyBasePath(responseUrl: URL, originalUrl: NextURL) {
  const { basePath } = originalUrl;
  if (!basePath || responseUrl.origin !== originalUrl.origin) {
    return;
  }
  // Middleware targets are app-relative, even when a route repeats the base path.
  // Preserve the request's slash style when targeting the app root.
  responseUrl.pathname =
    responseUrl.pathname === '/'
      ? applyTrailingSlash(new URL(originalUrl).pathname, basePath)
      : `${basePath}${responseUrl.pathname}`;
}

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
 * Extracts dynamic parameters from a path based on a shared path pattern
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
    if (segment.startsWith('[') && segment.endsWith(']')) {
      params.push(pathSegments[index]);
    }
  });

  return params;
}

/**
 * Replaces dynamic segments in a path with their actual values
 */
export function replaceDynamicSegments(
  path: string,
  templatePath: string,
  params?: string[]
): string {
  if (!templatePath.includes('[')) {
    return applyTrailingSlash(path, templatePath);
  }

  const pathParams = params ?? extractDynamicParams(templatePath, path);
  let paramIndex = 0;
  const result = templatePath.replace(/\[([^\]]+)\]/g, (match: string) => {
    return pathParams[paramIndex++] || match;
  });
  return applyTrailingSlash(path, result);
}

/**
 * Gets the full localized path given a shared path and locale
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

type PathMapping = { sharedPath: string; sourceTemplate: string };

/**
 * Creates a map of localized paths to shared paths using regex patterns
 */
export function createPathToSharedPathMap(
  pathConfig: PathConfig,
  prefixDefaultLocale: boolean,
  defaultLocale: string
): {
  pathToSharedPath: Record<string, PathMapping>;
  unprefixedPathToSharedPath: Record<string, PathMapping>;
  sharedOnlyPathToSharedPath: Record<string, PathMapping>;
  defaultLocalePaths: string[];
} {
  return Object.entries(pathConfig).reduce<{
    pathToSharedPath: Record<string, PathMapping>;
    unprefixedPathToSharedPath: Record<string, PathMapping>;
    sharedOnlyPathToSharedPath: Record<string, PathMapping>;
    defaultLocalePaths: string[];
  }>(
    (acc, [sharedPath, localizedPaths]) => {
      const {
        pathToSharedPath,
        unprefixedPathToSharedPath,
        sharedOnlyPathToSharedPath,
        defaultLocalePaths,
      } = acc;
      // Preserve raw templates for parameter substitution and output URLs.
      const sharedPattern = createPathPattern(sharedPath);
      const sharedMapping = { sharedPath, sourceTemplate: sharedPath };
      unprefixedPathToSharedPath[sharedPattern] = sharedMapping;
      sharedOnlyPathToSharedPath[sharedPattern] = sharedMapping;

      if (typeof localizedPaths === 'object') {
        Object.entries(localizedPaths).forEach(([locale, localizedPath]) => {
          // Convert the localized path to a regex pattern
          // Replace [param] with [^/]+ to match any non-slash characters
          const pattern = createPathPattern(localizedPath);
          pathToSharedPath[stripTrailingSlashes(`/${locale}${pattern}`)] = {
            sharedPath,
            sourceTemplate: `/${locale}${localizedPath}`,
          };
          if (!prefixDefaultLocale && locale === defaultLocale) {
            unprefixedPathToSharedPath[pattern] = {
              sharedPath,
              sourceTemplate: localizedPath,
            };
            defaultLocalePaths.push(pattern);
          }
        });
      }
      return acc;
    },
    {
      pathToSharedPath: {},
      unprefixedPathToSharedPath: {},
      sharedOnlyPathToSharedPath: {},
      defaultLocalePaths: [],
    }
  );
}

/**
 * Gets the shared path from a given pathname, handling both static and dynamic paths
 */
export function getSharedPath(
  standardizedPathname: string,
  pathToSharedPath: Record<string, PathMapping>,
  pathnameLocale: string | undefined,
  sharedOnlyPathToSharedPath: Record<string, PathMapping>
): { sharedPath: string; params: string[] } | undefined {
  const rawPathname = standardizedPathname;
  const match = (mapping: PathMapping, pathname: string) => ({
    sharedPath: mapping.sharedPath,
    params: extractDynamicParams(mapping.sourceTemplate, pathname),
  });
  standardizedPathname = normalizePathForMatching(standardizedPathname);
  const pathnameWithoutTrailingSlash =
    stripTrailingSlashes(standardizedPathname);
  // Try exact match first
  if (pathToSharedPath[pathnameWithoutTrailingSlash]) {
    return match(pathToSharedPath[pathnameWithoutTrailingSlash], rawPathname);
  }

  // Without locale prefix
  let pathnameWithoutLocale = undefined;
  // Only remove locale prefix if the locale prefix is valid
  if (pathnameLocale) {
    pathnameWithoutLocale = stripTrailingSlashes(
      standardizedPathname.replace(/^\/[^/]+/, '')
    );
    if (sharedOnlyPathToSharedPath[pathnameWithoutLocale]) {
      return match(
        sharedOnlyPathToSharedPath[pathnameWithoutLocale],
        rawPathname.replace(/^\/[^/]+/, '') || '/'
      );
    }
  }

  // Try regex pattern match
  for (const [pattern, mapping] of Object.entries(pathToSharedPath)) {
    if (pattern.includes(DYNAMIC_PATH_SEGMENT_PATTERN)) {
      // Convert the pattern to a strict regex that matches the exact path structure
      const regex = new RegExp(`^${pattern}$`);
      // Exact match
      // Shared patterns must not consume a recognized locale as a parameter.
      // The full-path map contains only aliases when a locale is recognized.
      if (regex.test(pathnameWithoutTrailingSlash)) {
        return match(mapping, rawPathname);
      }
    }
  }

  // Without locale prefix
  // Once the locale is removed, the remaining segments are shared route data.
  if (pathnameWithoutLocale !== undefined) {
    for (const [pattern, mapping] of Object.entries(
      sharedOnlyPathToSharedPath
    )) {
      if (
        pattern.includes(DYNAMIC_PATH_SEGMENT_PATTERN) &&
        new RegExp(`^${pattern}$`).test(pathnameWithoutLocale)
      ) {
        return match(mapping, rawPathname.replace(/^\/[^/]+/, '') || '/');
      }
    }
  }
  return undefined;
}

/**
 * Checks if the pathname is in the default locale paths
 * @param pathname - The pathname to check
 * @param defaultLocalePaths - The default locale paths
 * @returns true if the pathname is in the default locale paths, false otherwise
 */

function inDefaultLocalePaths(
  pathname: string,
  defaultLocalePaths: string[]
): boolean {
  pathname = stripTrailingSlashes(normalizePathForMatching(pathname));
  // Try exact match first
  if (defaultLocalePaths.includes(pathname)) {
    return true;
  }

  // Try regex pattern match
  for (const path of defaultLocalePaths) {
    if (path.includes(DYNAMIC_PATH_SEGMENT_PATTERN)) {
      const regex = new RegExp(`^${path}$`);
      if (regex.test(pathname)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Gets the locale from the request using various sources
 */
export function getLocaleFromRequest(
  req: NextRequest,
  defaultLocale: string,
  approvedLocales: string[],
  localeRouting: boolean,
  gtServicesEnabled: boolean,
  prefixDefaultLocale: boolean,
  defaultLocalePaths: string[],
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
