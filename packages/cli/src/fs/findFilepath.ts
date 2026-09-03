import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../console/logger.js';
import { exitSync } from '../console/logging.js';
import {
  decodeAppleText,
  detectAppleTextEncoding,
  LONGEST_BYTE_ORDER_MARK,
  type AppleTextEncoding,
} from './appleEncoding.js';

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
    logger.error(errorMessage);
    exitSync(1);
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
 * Read a file and return the contents.
 * @param {string} filePath - The path to the file to read.
 * @returns {string} - The contents of the file.
 */
export function readFile(filePath: string): string {
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return fs.readFileSync(filePath, 'utf8');
  }
  return '';
}

/**
 * Read a file as raw bytes and return it base64-encoded. Used for binary
 * formats (e.g. Lottie zip bundles) whose content must not be decoded as UTF-8.
 * @param {string} filePath - The path to the file to read.
 * @returns {string} - The base64-encoded contents, or '' if the file is absent.
 */
export function readBinaryFileBase64(filePath: string): string {
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return fs.readFileSync(filePath).toString('base64');
  }
  return '';
}

/**
 * Read a `.strings` or `.stringsdict` file, decoding it by its byte order mark.
 * Older Xcode wrote both as UTF-16, and reading those bytes as UTF-8 replaces
 * them with U+FFFD. The encoding comes back so a translated file can be written
 * in the same layout as the source it came from.
 * @param {string} filePath - The path to the file to read.
 * @returns The decoded text and the encoding the file was stored in.
 */
export function readAppleTextFile(filePath: string): {
  text: string;
  encoding: AppleTextEncoding;
} {
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return decodeAppleText(fs.readFileSync(filePath));
  }
  return { text: '', encoding: 'utf8' };
}

/**
 * Read only the byte order mark of a `.strings` or `.stringsdict` file. Used
 * when writing a translation, where the source file's encoding is wanted but
 * its content is not.
 * @param {string} filePath - The path to the file to inspect.
 * @returns The encoding the file is stored in, defaulting to UTF-8.
 */
export function readAppleTextEncoding(filePath: string): AppleTextEncoding {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return 'utf8';
  }
  const handle = fs.openSync(filePath, 'r');
  try {
    const mark = Buffer.alloc(LONGEST_BYTE_ORDER_MARK);
    const read = fs.readSync(handle, mark, 0, mark.length, 0);
    return detectAppleTextEncoding(mark.subarray(0, read));
  } finally {
    fs.closeSync(handle);
  }
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
    logger.error('Error finding file in directory: ' + String(error));
  }
  return '';
}

export function getRelative(absolutePath: string): string {
  const path2 = path.resolve(absolutePath);
  return path.relative(process.cwd(), path2);
}
