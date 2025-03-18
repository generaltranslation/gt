import { NextRequest } from 'next/server';
import {
  isValidLocale,
  determineLocale,
  standardizeLocale,
  isSameDialect,
} from 'generaltranslation';
import {
  libraryDefaultLocale,
  localeCookieName,
  localeHeaderName,
} from 'generaltranslation/internal';
import { createUnsupportedLocalesWarning } from '../errors/createErrors';
import {
  middlewareLocaleName,
  middlewareLocaleResetFlagName,
  middlewareLocaleRewriteFlagName,
} from '../utils/constants';

export type PathConfig = {
  [key: string]: string | { [key: string]: string };
};

/**
 * Extracts the locale from the given pathname.
 */
export function extractLocale(pathname: string): string | null {
  const matches = pathname.match(/^\/([^\/]+)(?:\/|$)/);
  return matches ? matches[1] : null;
}

/**
 * Gets the shared path from a given pathname, handling both static and dynamic paths
 */
export function getSharedPath(
  pathname: string,
  pathToSharedPath: { [key: string]: string }
): string | undefined {
  // Try exact match first
  if (pathToSharedPath[pathname]) {
    return pathToSharedPath[pathname];
  }

  // Try regex pattern match
  for (const [pattern, sharedPath] of Object.entries(pathToSharedPath)) {
    if (pattern.includes('[^/]+')) {
      // Convert the pattern to a strict regex that matches the exact path structure
      const regex = new RegExp(`^${pattern.replace(/\//g, '\\/')}$`);
      if (regex.test(pathname)) {
        return sharedPath;
      }
    }
  }

  return undefined;
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
  templatePath: string
): string {
  if (!templatePath.includes('[')) return templatePath;

  const params = extractDynamicParams(templatePath, path);
  let paramIndex = 0;
  const result = templatePath.replace(/\[([^\]]+)\]/g, (match: string) => {
    return params[paramIndex++] || match;
  });
  return result;
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

/**
 * Creates a map of localized paths to shared paths using regex patterns
 */
export function createPathToSharedPathMap(pathConfig: PathConfig): {
  [key: string]: string;
} {
  return Object.entries(pathConfig).reduce<{ [key: string]: string }>(
    (acc, [sharedPath, localizedPath]) => {
      // Add the shared path itself, converting to regex pattern if it has dynamic segments
      if (sharedPath.includes('[')) {
        const pattern = sharedPath.replace(/\[([^\]]+)\]/g, '[^/]+');
        acc[pattern] = sharedPath;
      } else {
        acc[sharedPath] = sharedPath;
      }

      if (typeof localizedPath === 'object') {
        Object.values(localizedPath).forEach((localizedPath) => {
          // Convert the localized path to a regex pattern
          // Replace [param] with [^/]+ to match any non-slash characters
          const pattern = localizedPath.replace(/\[([^\]]+)\]/g, '[^/]+');
          acc[pattern] = sharedPath;
        });
      }
      return acc;
    },
    {}
  );
}

/**
 * Gets the locale from the request using various sources
 */
export function getLocaleFromRequest(
  req: NextRequest,
  defaultLocale: string,
  approvedLocales: string[],
  localeRouting: boolean
): {
  userLocale: string;
  pathnameLocale: string | undefined;
  unstandardizedPathnameLocale: string | null | undefined;
} {
  const headerList = new Headers(req.headers);
  const candidates: string[] = [];

  // Check pathname locales
  let pathnameLocale, unstandardizedPathnameLocale;
  const { pathname } = req.nextUrl;
  if (localeRouting) {
    unstandardizedPathnameLocale = extractLocale(pathname);
    const extractedLocale = standardizeLocale(
      unstandardizedPathnameLocale || ''
    );
    if (isValidLocale(extractedLocale)) {
      pathnameLocale = extractedLocale;
      candidates.push(pathnameLocale);
    }
  }

  // Check cookie locale
  const cookieLocale = req.cookies.get(localeCookieName);
  if (cookieLocale?.value && isValidLocale(cookieLocale?.value)) {
    const resetCookieName = middlewareLocaleResetFlagName;
    const resetCookie = req.cookies.get(resetCookieName);
    if (resetCookie?.value) {
      candidates.unshift(cookieLocale.value);
    } else {
      candidates.push(cookieLocale.value);
    }
  }

  // Check referer locale
  let refererLocale;
  if (localeRouting) {
    const referer = headerList.get('referer');
    if (referer && typeof referer === 'string') {
      refererLocale = extractLocale(new URL(referer)?.pathname);
      if (isValidLocale(refererLocale || ''))
        candidates.push(refererLocale || '');
    }
  }

  // Get locales from accept-language header
  const acceptedLocales =
    headerList
      .get('accept-language')
      ?.split(',')
      .map((item) => item.split(';')?.[0].trim()) || [];
  candidates.push(...acceptedLocales);

  // Get default locale
  candidates.push(defaultLocale);

  // determine userLocale
  const userLocale = standardizeLocale(
    determineLocale(candidates.filter(isValidLocale), approvedLocales) ||
      defaultLocale
  );

  return {
    userLocale,
    pathnameLocale,
    unstandardizedPathnameLocale,
  };
}
