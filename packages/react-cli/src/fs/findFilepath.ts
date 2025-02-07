import fs from 'fs';
import path from 'path';

/**
 * Resolve the file path from the given file path or default paths.
 * @param {string} filePath - The file path to resolve.
 * @param {string[]} defaultPaths - The default paths to check.
 * @returns {string} - The resolved file path.
 */
export default function findFilepath(
  paths: string[],
  errorMessage: string = ''
): string {
  return findFilepaths(paths, errorMessage)?.[0] || '';
}

/**
 * Resolve the file paths from the given file paths or default paths.
 * @param {string[]} paths - The file paths to resolve.
 * @param {string} errorMessage - The error message to throw if no paths are found.
 * @returns {string[]} - The resolved file paths.
 */
export function findFilepaths(
  paths: string[],
  errorMessage: string = ''
): string[] {
  const resolvedPaths: string[] = [];
  for (const possiblePath of paths) {
    if (fs.existsSync(possiblePath)) {
      resolvedPaths.push(possiblePath);
    }
  }
  if (errorMessage) {
    throw new Error(errorMessage);
  }
  return resolvedPaths;
}

export function getRelativePath(file: string, srcDirectory: string): string {
  // Create relative path from src directory and remove extension
  return path
    .relative(
      srcDirectory,
      file.replace(/\.[^/.]+$/, '') // Remove file extension
    )
    .replace(/\\/g, '.') // Replace Windows backslashes with dots
    .split(/[./]/) // Split on dots or forward slashes
    .filter(Boolean) // Remove empty segments that might cause extra dots
    .map((segment) => segment.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()) // Convert each segment to snake case
    .join('.'); // Rejoin with dots
}
