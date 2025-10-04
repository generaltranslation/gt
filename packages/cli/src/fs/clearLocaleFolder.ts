import fs from 'fs/promises';
import path from 'node:path';
import { logSuccess, logWarning } from '../console/logging.js';

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

  // Normalize locales for comparison (case-insensitive)
  const normalizedLocales = new Set(
    locales.map((l) => l.toLowerCase())
  );

  for (const filePath of filePaths) {
    const parts = filePath.split(path.sep);

    // Find directory segments that match known locales
    for (let i = 0; i < parts.length - 1; i++) {
      const segment = parts[i];
      if (normalizedLocales.has(segment.toLowerCase())) {
        // Found a locale directory, capture up to and including this segment
        const localeDir = parts.slice(0, i + 1).join(path.sep);
        localeDirs.add(localeDir);
        break;
      }
    }
  }

  return localeDirs;
}

/**
 * Clears translated files before writing new translations
 * @param filePaths - Set of translated file paths to clear
 * @param locales - List of locale codes to identify locale directories
 */
export async function clearTranslatedFiles(
  filePaths: Set<string>,
  locales: string[]
): Promise<void> {
  // Extract locale directories and delete them recursively
  const localeDirs = extractLocaleDirectories(filePaths, locales);

  for (const dir of localeDirs) {
    try {
      await fs.stat(dir);
      await fs.rm(dir, { recursive: true, force: true });
      logSuccess(`Cleared locale directory: ${dir}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        logWarning(`Failed to clear locale directory ${dir}: ${error}`);
      }
    }
  }
}
