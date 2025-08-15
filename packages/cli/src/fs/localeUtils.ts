import { readdirSync } from 'node:fs';
import path from 'node:path';
import { isValidLocale } from 'generaltranslation';

/**
 * Recursively detects directories that are valid locale codes but not in the current locales list
 * @param cwd - The current working directory to scan
 * @param currentLocales - Array of locales currently in the config
 * @param maxDepth - Maximum depth to recurse (default: 3)
 * @returns Array of relative paths to excluded locale directories (e.g., ['es', 'snippets/es'])
 */
export function detectExcludedLocaleDirectories(
  cwd: string,
  currentLocales: string[],
  maxDepth: number = 3
): string[] {
  const validLocaleDirectoryPaths: string[] = [];

  function scanDirectory(currentPath: string, relativePath: string, depth: number) {
    if (depth > maxDepth) return;

    try {
      const entries = readdirSync(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const dirName = entry.name;
          const currentRelativePath = relativePath 
            ? `${relativePath}/${dirName}`
            : dirName;

          // Check if directory name is a valid locale and not in current config
          if (isValidLocale(dirName) && !currentLocales.includes(dirName)) {
            validLocaleDirectoryPaths.push(currentRelativePath);
          } else {
            // Continue recursing into non-locale directories
            scanDirectory(
              path.join(currentPath, dirName),
              currentRelativePath,
              depth + 1
            );
          }
        }
      }
    } catch (error) {
      // If we can't read this directory, continue with others
      return;
    }
  }

  scanDirectory(cwd, '', 0);
  return validLocaleDirectoryPaths;
}
