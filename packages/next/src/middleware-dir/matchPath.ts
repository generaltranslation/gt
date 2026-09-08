import {
  DYNAMIC_PATH_SEGMENT_PATTERN,
  normalizePathForMatching,
} from './createPathMatcher';
import { stripTrailingSlashes } from './pathname';

/**
 * Gets the shared path from a given pathname, handling both static and dynamic paths
 */
export function getSharedPath(
  standardizedPathname: string,
  pathToSharedPath: { [key: string]: string },
  pathnameLocale: string | undefined
): string | undefined {
  standardizedPathname = normalizePathForMatching(standardizedPathname);
  const pathnameWithoutTrailingSlash =
    stripTrailingSlashes(standardizedPathname);
  // Try exact match first
  if (pathToSharedPath[pathnameWithoutTrailingSlash]) {
    return pathToSharedPath[pathnameWithoutTrailingSlash];
  }

  // Without locale prefix
  let pathnameWithoutLocale = undefined;
  // Only remove locale prefix if the locale prefix is valid
  if (pathnameLocale) {
    pathnameWithoutLocale = stripTrailingSlashes(
      standardizedPathname.replace(/^\/[^/]+/, '')
    );
    if (pathToSharedPath[pathnameWithoutLocale]) {
      return pathToSharedPath[pathnameWithoutLocale];
    }
  }

  // Try regex pattern match
  let candidateSharedPath = undefined;
  for (const [pattern, sharedPath] of Object.entries(pathToSharedPath)) {
    if (pattern.includes(DYNAMIC_PATH_SEGMENT_PATTERN)) {
      // Convert the pattern to a strict regex that matches the exact path structure
      const regex = new RegExp(`^${pattern}$`);
      // Exact match
      if (regex.test(pathnameWithoutTrailingSlash)) {
        return sharedPath;
      }
      // Without locale prefix
      if (
        !candidateSharedPath &&
        pathnameLocale &&
        regex.test(pathnameWithoutLocale as string)
      ) {
        candidateSharedPath = sharedPath;
      }
    }
  }
  return candidateSharedPath;
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
