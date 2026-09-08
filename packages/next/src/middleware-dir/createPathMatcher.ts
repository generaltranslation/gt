import { normalizePathname, stripTrailingSlashes } from './pathname';

export type PathConfig = {
  [key: string]: string | { [key: string]: string };
};

export const DYNAMIC_PATH_SEGMENT_PATTERN = '/[^/]+';
/** Normalizes each segment once without decoding encoded separators. */
export function normalizePathForMatching(pathname: string): string {
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

/**
 * Creates a map of localized paths to shared paths using regex patterns
 */
export function createPathToSharedPathMap(
  pathConfig: PathConfig,
  prefixDefaultLocale: boolean,
  defaultLocale: string
): {
  pathToSharedPath: { [key: string]: string };
  unprefixedPathToSharedPath: { [key: string]: string };
  defaultLocalePaths: string[];
} {
  return Object.entries(pathConfig).reduce<{
    pathToSharedPath: { [key: string]: string };
    unprefixedPathToSharedPath: { [key: string]: string };
    defaultLocalePaths: string[];
  }>(
    (acc, [sharedPath, localizedPaths]) => {
      const {
        pathToSharedPath,
        unprefixedPathToSharedPath,
        defaultLocalePaths,
      } = acc;
      // Preserve raw templates for parameter substitution and output URLs.
      const sharedPattern = createPathPattern(sharedPath);
      pathToSharedPath[sharedPattern] = sharedPath;
      unprefixedPathToSharedPath[sharedPattern] = sharedPath;

      if (typeof localizedPaths === 'object') {
        Object.entries(localizedPaths).forEach(([locale, localizedPath]) => {
          // Convert the localized path to a regex pattern
          // Replace [param] with [^/]+ to match any non-slash characters
          const pattern = createPathPattern(localizedPath);
          pathToSharedPath[stripTrailingSlashes(`/${locale}${pattern}`)] =
            sharedPath;
          if (!prefixDefaultLocale && locale === defaultLocale) {
            pathToSharedPath[pattern] = sharedPath;
            unprefixedPathToSharedPath[pattern] = sharedPath;
            defaultLocalePaths.push(pattern);
          }
        });
      }
      return acc;
    },
    {
      pathToSharedPath: {},
      unprefixedPathToSharedPath: {},
      defaultLocalePaths: [],
    }
  );
}
