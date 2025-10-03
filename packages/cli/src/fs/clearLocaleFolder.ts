import fs from 'fs/promises';
import path from 'node:path';
import { logSuccess, logWarning } from '../console/logging.js';

/**
 * Clears locale folders before writing new translations
 * @param localeFolders - Set of locale folder paths to clear
 */
export async function clearLocaleFolders(
  localeFolders: Set<string>
): Promise<void> {
  for (const folder of localeFolders) {
    try {
      await fs.stat(folder);
      await fs.rm(folder, { recursive: true, force: true });
      logSuccess(`Cleared locale folder: ${folder}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        logWarning(`Failed to clear locale folder ${folder}: ${error}`);
      }
    }
  }
}

/**
 * Extracts unique locale folders from file paths
 * @param filePaths - Array of file paths that contain locale-specific directories
 * @returns Set of unique locale folder paths
 */
export function extractLocaleFolders(filePaths: string[]): Set<string> {
  const folders = new Set<string>();

  for (const filePath of filePaths) {
    const dir = path.dirname(filePath);
    // Get the top-level locale directory by finding the parent until we hit a known locale pattern
    // For paths like "snippets/es/file.md", we want to capture "snippets/es"
    folders.add(dir);
  }

  return folders;
}
