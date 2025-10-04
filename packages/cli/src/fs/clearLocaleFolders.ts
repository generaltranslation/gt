import fs from 'fs/promises';
import path from 'node:path';
import { logSuccess, logWarning } from '../console/logging.js';

/**
 * Extracts locale directories from translated file paths.
 * Groups files by their immediate parent containing a locale code.
 * For example: "snippets/es/api-test/file.mdx" -> "snippets/es"
 */
function extractLocaleDirectories(filePaths: Set<string>): Set<string> {
  const localeDirs = new Set<string>();

  for (const filePath of filePaths) {
    const parts = filePath.split(path.sep);

    // Find directory segments that are likely locale codes (2-3 letter codes)
    for (let i = 0; i < parts.length - 1; i++) {
      const segment = parts[i];
      // Match common locale patterns: 2-5 chars, possibly with hyphen (en, es, en-US, zh-CN)
      if (/^[a-z]{2}(-[A-Z]{2})?$/.test(segment)) {
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
 */
export async function clearLocaleFolders(
  filePaths: Set<string>
): Promise<void> {
  // Extract locale directories and delete them recursively
  const localeDirs = extractLocaleDirectories(filePaths);

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
