import fs from 'fs/promises';
import path from 'node:path';
import { logSuccess, logWarning } from '../console/logging.js';
import fg from 'fast-glob';
import micromatch from 'micromatch';

/**
 * Extracts locale directories from translated file paths.
 * Groups files by their immediate parent containing a locale code.
 * For example: "snippets/es/api-test/file.mdx" -> "snippets/es"
 */
function extractLocaleDirectories(
  filePaths: Set<string>,
  locales: string[]
): Set<string> {
  const localeDirs = new Set<string>();
  const localeSet = new Set(locales);

  for (const filePath of filePaths) {
    const parts = filePath.split(path.sep);

    // Find directory segments that match the provided locales
    for (let i = 0; i < parts.length - 1; i++) {
      const segment = parts[i];
      if (localeSet.has(segment)) {
        // Found a locale directory, capture up to and including this segment
        const localeDir = parts.slice(0, i + 1).join(path.sep);
        localeDirs.add(localeDir);
        break;
      }
    }
  }

  return localeDirs;
}

async function getFilesToDelete(
  dirPath: string,
  excludePatterns: string[],
  currentLocale: string,
  cwd: string
): Promise<string[]> {
  const allFiles = await fg(path.join(dirPath, '**/*'), {
    absolute: true,
    onlyFiles: true,
  });

  const absoluteCwd = path.resolve(cwd);
  const expandedExcludePatterns = excludePatterns.map((p) => {
    const resolvedPattern = path.isAbsolute(p) ? p : path.join(absoluteCwd, p);
    return resolvedPattern
      .replace(/\[locale\]/g, currentLocale)
      .replace(/\[locales\]/g, currentLocale);
  });

  const filesToKeep = micromatch(allFiles, expandedExcludePatterns, {
    dot: true,
  });

  const filesToKeepSet = new Set(filesToKeep);
  return allFiles.filter((file) => !filesToKeepSet.has(file));
}

/**
 * Clears translated files before writing new translations
 * @param filePaths - Set of translated file paths to clear
 * @param locales - Array of locale codes to match against
 * @param excludePatterns - Optional array of glob patterns to exclude from clearing (supports [locale] and [locales])
 * @param cwd - Current working directory for resolving relative exclude patterns (defaults to process.cwd())
 */
export async function clearLocaleFolders(
  filePaths: Set<string>,
  locales: string[],
  excludePatterns?: string[],
  cwd: string = process.cwd()
): Promise<void> {
  // Extract locale directories
  const localeDirs = extractLocaleDirectories(filePaths, locales);

  for (const dir of localeDirs) {
    try {
      await fs.stat(dir);

      // Extract locale from directory path
      const dirParts = dir.split(path.sep);
      const locale = locales.find((loc) => dirParts.includes(loc));

      if (!locale) {
        continue;
      }

      if (!excludePatterns?.length) {
        await fs.rm(dir, { recursive: true, force: true });
        logSuccess(`Cleared locale directory: ${dir}`);
        continue;
      }

      const filesToDelete = await getFilesToDelete(
        dir,
        excludePatterns,
        locale,
        cwd
      );

      // Get all files for count comparison
      const allFiles = fg.sync(path.join(dir, '**/*'), {
        absolute: true,
        onlyFiles: true,
      });

      for (const file of filesToDelete) {
        try {
          await fs.unlink(file);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            logWarning(`Failed to delete file ${file}: ${error}`);
          }
        }
      }

      // Clean up empty directories
      await cleanupEmptyDirs(dir);

      const excludedCount = allFiles.length - filesToDelete.length;
      if (excludedCount > 0) {
        logSuccess(
          `Cleared locale directory: ${dir} (excluded ${excludedCount} file${excludedCount > 1 ? 's' : ''})`
        );
      } else {
        logSuccess(`Cleared locale directory: ${dir}`);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        logWarning(`Failed to clear locale directory ${dir}: ${error}`);
      }
    }
  }
}

/**
 * Recursively removes empty directories
 * @param dirPath - The directory to clean up
 */
async function cleanupEmptyDirs(dirPath: string): Promise<void> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    // Recursively clean subdirectories first
    for (const entry of entries) {
      if (entry.isDirectory()) {
        await cleanupEmptyDirs(path.join(dirPath, entry.name));
      }
    }

    // Check if directory is now empty
    const remainingEntries = await fs.readdir(dirPath);
    if (remainingEntries.length === 0) {
      await fs.rmdir(dirPath);
    }
  } catch (error) {
    // Ignore errors - directory might not exist or might not be empty
  }
}
