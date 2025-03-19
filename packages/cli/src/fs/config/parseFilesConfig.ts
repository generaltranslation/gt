import path from 'path';
import { FilesOptions, ResolvedFiles } from '../../types';
import fg from 'fast-glob';

/**
 * Resolves the files from the files object
 * Replaces [locale] with the actual locale in the files
 *
 * @param files - The files object
 * @param locale - The locale to replace [locale] with
 * @returns The resolved files
 */
export function resolveLocaleFiles(
  files: ResolvedFiles,
  locale: string
): ResolvedFiles {
  const result: ResolvedFiles = {};

  // Replace [locale] with locale in all paths
  result.json = files.json?.map((filepath) =>
    filepath.replace(/\[locale\]/g, locale)
  );

  // Replace [locale] with locale in all paths
  result.md = files.md?.map((filepath) =>
    filepath.replace(/\[locale\]/g, locale)
  );

  // Replace [locale] with locale in all paths
  result.mdx = files.mdx?.map((filepath) =>
    filepath.replace(/\[locale\]/g, locale)
  );

  return result;
}
/**
 * Resolves the files from the files object
 * Performs glob pattern expansion on the files
 * Replaces [locale] with the actual locale in the files
 *
 * @param files - The files object
 * @returns The resolved files
 */
export function resolveFiles(
  files: FilesOptions,
  locale: string
): { resolvedPaths: ResolvedFiles; placeholderPaths: ResolvedFiles } {
  // Initialize result object with empty arrays for each file type
  const result: ResolvedFiles = {};
  const placeholderResult: ResolvedFiles = {};

  // Process JSON files
  if (files.json?.include) {
    if (files.json.include.length > 1) {
      console.error('Only one JSON file is supported at the moment.');
      process.exit(1);
    }

    if (files.json.include.length === 1) {
      const jsonPaths = expandGlobPatterns([files.json.include[0]], locale);
      if (jsonPaths.resolvedPaths.length > 1) {
        console.error(
          'JSON glob pattern matched multiple files. Only one JSON file is supported.'
        );
        process.exit(1);
      }
      result.json = jsonPaths.resolvedPaths;
      placeholderResult.json = jsonPaths.placeholderPaths;
    }
  }

  // Process MD files
  if (files.md?.include) {
    const mdPaths = expandGlobPatterns(files.md.include, locale);
    result.md = mdPaths.resolvedPaths;
    placeholderResult.md = mdPaths.placeholderPaths;
  }

  // Process MDX files
  if (files.mdx?.include) {
    const mdxPaths = expandGlobPatterns(files.mdx.include, locale);
    result.mdx = mdxPaths.resolvedPaths;
    placeholderResult.mdx = mdxPaths.placeholderPaths;
  }

  return { resolvedPaths: result, placeholderPaths: placeholderResult };
}

// Helper function to expand glob patterns
function expandGlobPatterns(
  patterns: string[],
  locale: string
): {
  resolvedPaths: string[];
  placeholderPaths: string[];
} {
  // Expand glob patterns to include all matching files
  const resolvedPaths: string[] = [];
  const placeholderPaths: string[] = [];

  for (const pattern of patterns) {
    // Track positions where [locale] appears in the original pattern
    const localePositions: number[] = [];
    let searchIndex = 0;
    const localeTag = '[locale]';

    while (true) {
      const foundIndex = pattern.indexOf(localeTag, searchIndex);
      if (foundIndex === -1) break;
      localePositions.push(foundIndex);
      searchIndex = foundIndex + localeTag.length;
    }

    const expandedPattern = pattern.replace(/\[locale\]/g, locale);

    // Check if the pattern contains glob characters
    if (
      expandedPattern.includes('*') ||
      expandedPattern.includes('?') ||
      expandedPattern.includes('{')
    ) {
      // Resolve the absolute pattern path
      const absolutePattern = path.resolve(process.cwd(), expandedPattern);
      // Use fast-glob to find all matching files
      const matches = fg.sync(absolutePattern, { absolute: true });
      resolvedPaths.push(...matches);

      // For each match, create a version with [locale] in the correct positions
      matches.forEach((match) => {
        // Convert to relative path to make replacement easier
        const relativePath = path.relative(process.cwd(), match);
        let originalRelativePath = relativePath;

        // Replace locale with [locale] at each tracked position
        if (localePositions.length > 0) {
          // We need to account for path resolution differences
          // This is a simplified approach - we'll replace all instances of the locale
          // but only in path segments where we expect it based on the original pattern
          const pathParts = relativePath.split(path.sep);
          const patternParts = pattern.split(/[\/\\]/); // Handle both slash types

          for (let i = 0; i < pathParts.length; i++) {
            if (i < patternParts.length) {
              if (patternParts[i].includes(localeTag)) {
                // This segment should have the locale replaced
                pathParts[i] = pathParts[i].replace(locale, localeTag);
              }
            }
          }

          originalRelativePath = pathParts.join(path.sep);
        }

        // Convert back to absolute path
        const originalPath = path.resolve(process.cwd(), originalRelativePath);
        placeholderPaths.push(originalPath);
      });
    } else {
      // If it's not a glob pattern, just add the resolved path
      const absolutePath = path.resolve(process.cwd(), expandedPattern);
      resolvedPaths.push(absolutePath);

      // For non-glob patterns, we can directly replace locale with [locale]
      // at the tracked positions in the resolved path
      let originalPath = path.resolve(process.cwd(), pattern);
      placeholderPaths.push(originalPath);
    }
  }

  return { resolvedPaths, placeholderPaths };
}
