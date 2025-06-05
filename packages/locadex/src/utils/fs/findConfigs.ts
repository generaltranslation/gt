import path from 'node:path';
import fs from 'node:fs';
import { logger } from '../../logging/logger.js';

export function findTsConfig(): string | null {
  const cwd = process.cwd();
  const possiblePaths = [
    path.join(cwd, 'tsconfig.json'),
    path.join(cwd, 'tsconfig.app.json'),
    path.join(cwd, 'jsconfig.json'),
  ];

  for (const configPath of possiblePaths) {
    if (fs.existsSync(configPath)) {
      return configPath;
    }
  }

  return null;
}

export function findWebpackConfig(): string | null {
  const cwd = process.cwd();
  const possiblePaths = [
    path.join(cwd, 'webpack.config.js'),
    path.join(cwd, 'webpack.config.ts'),
    path.join(cwd, 'next.config.js'),
    path.join(cwd, 'next.config.ts'),
  ];

  for (const configPath of possiblePaths) {
    if (fs.existsSync(configPath)) {
      return configPath;
    }
  }

  return null;
}
/**
 * Resolve the file paths from the given file paths or default paths.
 * @param {string[]} paths - The file paths to resolve.
 * @param {string} errorMessage - The error message to throw if no paths are found.
 * @returns {string[]} - The resolved file paths.
 */
export function findFilepaths(paths: string[]): string[] {
  const resolvedPaths: string[] = [];
  for (const possiblePath of paths) {
    if (fs.existsSync(possiblePath)) {
      resolvedPaths.push(possiblePath);
    }
  }
  return resolvedPaths;
}
