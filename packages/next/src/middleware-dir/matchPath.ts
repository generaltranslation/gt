import {
  DYNAMIC_PATH_SEGMENT_PATTERN,
  normalizePathForMatching,
  type PathMapping,
} from './createPathMatcher';
import { stripTrailingSlashes } from './pathname';

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

export function inDefaultLocalePaths(
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
