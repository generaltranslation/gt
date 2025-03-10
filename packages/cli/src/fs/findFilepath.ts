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

/**
 * Find a file in a directory based on a wildcard pattern.
 * @param {string} filePattern - The wildcard pattern to search for.
 * @param {string} file - The file to search for.
 * @returns {string} - The path to the file.
 */
export function findFile(filePattern: string, file: string): string {
  // Handle wildcard pattern by replacing the wildcard with the file parameter
  const resolvedPath = filePattern.replace(/\*/, file);

  if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
    return fs.readFileSync(resolvedPath, 'utf8');
  }
  return '';
}

/**
 * Find a file in a directory.
 * @param {string} dir - The directory to search in.
 * @param {string} file - The file to search for.
 * @returns {string} - The path to the file.
 */
export function findFileInDir(dir: string, file: string): string {
  const resolvedPath = path.join(dir, file);
  try {
    if (fs.existsSync(resolvedPath)) {
      return fs.readFileSync(resolvedPath, 'utf8');
    }
  } catch (error) {
    console.error(error);
  }
  return '';
}
