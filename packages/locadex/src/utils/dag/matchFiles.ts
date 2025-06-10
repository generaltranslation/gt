import { logger } from '../../logging/logger.js';
import * as path from 'node:path';
import fg from 'fast-glob';
import {
  DAG_IGNORED_EXTENSIONS,
  DAG_IGNORED_FILES,
  DAG_IGNORED_PATTERNS,
} from '../shared.js';

export function findSourceFiles(
  globPatterns: string[],
  allowedExtensions: string[],
  cwd: string = process.cwd()
): string[] {
  const allFiles: string[] = [];

  for (const pattern of globPatterns) {
    try {
      const matchedFiles = fg.sync(pattern, {
        cwd,
        absolute: true,
        onlyFiles: true,
        ignore: DAG_IGNORED_PATTERNS,
      });

      allFiles.push(...matchedFiles);
    } catch (error) {
      logger.debugMessage(
        `Failed to process glob pattern "${pattern}": ${error}`
      );
    }
  }

  // Remove duplicates
  const uniqueFiles = Array.from(new Set(allFiles));

  // Filter by extensions and apply blacklists
  const filteredFiles = uniqueFiles.filter((file) => {
    const filename = path.basename(file);
    const ext = path.extname(file);

    // Skip blacklisted extensions and files
    if (
      DAG_IGNORED_EXTENSIONS.includes(ext) ||
      DAG_IGNORED_FILES.includes(filename)
    ) {
      return false;
    }

    // Apply extension filter
    return allowedExtensions.includes(ext);
  });

  return filteredFiles;
}
