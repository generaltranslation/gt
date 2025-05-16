import path from 'node:path';
import { FilesOptions, ResolvedFiles, TransformFiles } from '../../types';
import fg from 'fast-glob';
import { SUPPORTED_FILE_EXTENSIONS } from '../../formats/files/supportedFiles';
import { logWarning } from '../../console';
import chalk from 'chalk';

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

  for (const fileType of SUPPORTED_FILE_EXTENSIONS) {
    result[fileType] = files[fileType]?.map((filepath) =>
      filepath.replace(/\[locale\]/g, locale)
    );
  }

  // Replace [locale] with locale in all paths
  result.gt = files.gt?.replace(/\[locale\]/g, locale);

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
): {
  resolvedPaths: ResolvedFiles;
  placeholderPaths: ResolvedFiles;
  transformPaths: TransformFiles;
} {
  // Initialize result object with empty arrays for each file type
  const result: ResolvedFiles = {};
  const placeholderResult: ResolvedFiles = {};
  const transformPaths: TransformFiles = {};

  // Process GT files
  if (files.gt?.output) {
    placeholderResult.gt = files.gt.output;
  }

  for (const fileType of SUPPORTED_FILE_EXTENSIONS) {
    // ==== TRANSFORMS ==== //
    if (
      files[fileType]?.transform &&
      !Array.isArray(files[fileType].transform)
    ) {
      transformPaths[fileType] = files[fileType].transform;
    }
    // ==== PLACEHOLDERS ==== //
    if (files[fileType]?.include) {
      const filePaths = expandGlobPatterns(
        files[fileType].include,
        files[fileType]?.exclude || [],
        locale,
        transformPaths[fileType] || undefined
      );
      result[fileType] = filePaths.resolvedPaths;
      placeholderResult[fileType] = filePaths.placeholderPaths;
    }
  }

  return {
    resolvedPaths: result,
    placeholderPaths: placeholderResult,
    transformPaths: transformPaths,
  };
}

// Helper function to expand glob patterns
function expandGlobPatterns(
  includePatterns: string[],
  excludePatterns: string[],
  locale: string,
  transformPatterns?: string
): {
  resolvedPaths: string[];
  placeholderPaths: string[];
} {
  // Expand glob patterns to include all matching files
  const resolvedPaths: string[] = [];
  const placeholderPaths: string[] = [];

  // Process include patterns
  for (const pattern of includePatterns) {
    // Track positions where [locale] appears in the original pattern
    // It must be included in the pattern, otherwise the CLI tool will not be able to find the correct output path
    // Warn if it's not included
    if (!pattern.includes('[locale]') && !transformPatterns) {
      logWarning(
        chalk.yellow(
          `Pattern "${pattern}" does not include [locale], so the CLI tool may incorrectly save translated files.`
        )
      );
    }
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

    // Resolve the absolute pattern path
    const absolutePattern = path.resolve(process.cwd(), expandedPattern);

    // Prepare exclude patterns with locale replaced
    const expandedExcludePatterns = excludePatterns.map((p) =>
      path.resolve(process.cwd(), p.replace(/\[locale\]/g, locale))
    );

    // Use fast-glob to find all matching files, excluding the patterns
    const matches = fg.sync(absolutePattern, {
      absolute: true,
      ignore: expandedExcludePatterns,
    });

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
  }

  return { resolvedPaths, placeholderPaths };
}
