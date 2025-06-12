import { logger } from '../../logging/logger.js';
import * as path from 'node:path';
import fg from 'fast-glob';
import micromatch from 'micromatch';
const { isMatch } = micromatch;
import {
  DAG_IGNORED_EXTENSIONS,
  DAG_IGNORED_FILES,
  DAG_IGNORED_PATTERNS,
} from '../shared.js';

export function findSourceFiles(globPatterns: string[], cwd: string): string[] {
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

    const hasBlacklistedExtension = DAG_IGNORED_EXTENSIONS.some(
      (blacklistedExt) => filename.endsWith(blacklistedExt)
    );

    // Skip blacklisted extensions and files
    if (hasBlacklistedExtension || DAG_IGNORED_FILES.includes(filename)) {
      return false;
    }

    return true;
  });

  return filteredFiles;
}

export function filterFiles(
  globPatterns: string[],
  filePaths: string[],
  cwd: string
): string[] {
  if (globPatterns.length === 0) {
    return filePaths;
  }

  return filePaths.filter((filePath) => {
    // Convert to relative path if absolute
    const relativePath = path.isAbsolute(filePath)
      ? path.relative(cwd, filePath)
      : filePath;

    // Check if file matches any of the glob patterns
    return globPatterns.some((pattern) => {
      try {
        return isMatch(relativePath, pattern);
      } catch (error) {
        logger.debugMessage(
          `Failed to match file "${filePath}" against pattern "${pattern}": ${error}`
        );
        return false;
      }
    });
  });
}
