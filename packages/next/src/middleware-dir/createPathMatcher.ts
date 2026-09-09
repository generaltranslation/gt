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

export type PathMapping = { sharedPath: string; sourceTemplate: string };

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
