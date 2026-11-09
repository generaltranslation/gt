import path from 'node:path';
import { hashStringSync } from '../utils/hash.js';

export interface PathPlatform {
  relative(from: string, to: string): string;
  resolve(...paths: string[]): string;
  isAbsolute(p: string): boolean;
  sep: string;
}

export const hostPlatform: PathPlatform = {
  relative: path.relative,
  resolve: path.resolve,
  isAbsolute: path.isAbsolute,
  sep: path.sep,
};

export const win32Platform: PathPlatform = {
  relative: path.win32.relative,
  resolve: path.win32.resolve,
  isAbsolute: path.win32.isAbsolute,
  sep: path.win32.sep,
};

export const posixPlatform: PathPlatform = {
  relative: path.posix.relative,
  resolve: path.posix.resolve,
  isAbsolute: path.posix.isAbsolute,
  sep: path.posix.sep,
};

export type PathComparisonOptions = {
  cwd?: string;
  foreignRoot?: string;
};

/**
 * Returns true if a relative path escapes the root directory.
 * Path-aware: correctly allows names like '..config/file.ts' or '.../file.ts'.
 */
function escapesRoot(rel: string): boolean {
  return rel === '..' || rel.startsWith('../') || rel.startsWith('..\\');
}

/**
 * Returns a normalized POSIX relative path from the project root (process.cwd()).
 * On Windows, directory backslashes are converted to forward slashes.
 * On POSIX, legitimate literal backslashes in filenames remain untouched.
 *
 * @param filePath - Host filesystem path (absolute or relative)
 * @param cwd - Project root directory (defaults to process.cwd())
 * @param platform - Path engine (defaults to hostPlatform)
 * @returns Canonical portable relative path (e.g. "public/locales/en.json")
 */
export function getRelative(
  filePath: string,
  cwd: string = process.cwd(),
  platform: PathPlatform = hostPlatform
): string {
  const resolved = platform.resolve(cwd, filePath);
  const rel = platform.relative(cwd, resolved);

  if (platform.sep === '\\') {
    // Windows OS: backslash is strictly a directory separator
    return rel.replace(/\\/g, '/');
  }

  // POSIX: backslash is a valid filename character, not a separator
  return rel;
}

/**
 * Computes the persistent, immutable file identity hash.
 * Preserves exact native platform hash inputs:
 * - On Windows: hashes path.win32.relative(cwd, filePath) with backslashes
 * - On POSIX: hashes path.posix.relative(cwd, filePath) with forward slashes
 *
 * @param filePath - Host filesystem path
 * @param cwd - Project root directory (defaults to process.cwd())
 * @param platform - Path engine (defaults to hostPlatform; tests inject win32Platform)
 * @returns SHA-256 hash string
 */
export function getFileId(
  filePath: string,
  cwd: string = process.cwd(),
  platform: PathPlatform = hostPlatform
): string {
  const resolved = platform.resolve(cwd, filePath);
  const nativeRelative = platform.relative(cwd, resolved);
  return hashStringSync(nativeRelative);
}

/**
 * Converts a path explicitly identified as serialized under Windows conventions
 * (e.g. legacy lockfile entry.fileName like "public\\locales\\en.json")
 * into a canonical PortablePath.
 */
export function fromWindowsSerializedPath(winPath: string): string {
  return winPath.replace(/^[a-zA-Z]:[\\/]/, '').replace(/\\/g, '/');
}

/**
 * Compares two paths to determine if they refer to the same project-relative file.
 * Returns false when a foreign absolute path has no explicitly provided root mapping.
 *
 * @param pathA - First path (host-native absolute or project-relative)
 * @param pathB - Second path (host-native absolute or project-relative)
 * @param options - Comparison options (cwd, foreignRoot)
 */
export function isSameFilePath(
  pathA: string,
  pathB: string,
  options?: PathComparisonOptions
): boolean {
  const cwd = options?.cwd ?? process.cwd();

  const toComparable = (p: string): string | null => {
    // 1. If explicit foreignRoot is provided, check if path is relative to it
    if (options?.foreignRoot) {
      if (/^[a-zA-Z]:[\\/]|^\\\\/.test(p)) {
        const rel = path.win32.relative(options.foreignRoot, p);
        if (!escapesRoot(rel) && !path.win32.isAbsolute(rel)) {
          return rel.replace(/\\/g, '/');
        }
      } else if (p.startsWith('/')) {
        const rel = path.posix.relative(options.foreignRoot, p);
        if (!escapesRoot(rel) && !path.posix.isAbsolute(rel)) return rel;
      }
    }

    // 2. Host-native absolute path
    if (hostPlatform.sep === '\\') {
      // On Windows, native absolute paths must have a drive letter or UNC prefix
      if (/^[a-zA-Z]:[\\/]|^\\\\/.test(p)) {
        const rel = hostPlatform.relative(cwd, p);
        if (escapesRoot(rel) || hostPlatform.isAbsolute(rel)) return null;
        return rel.replace(/\\/g, '/');
      }
    } else {
      // On POSIX, native absolute paths start with /
      if (p.startsWith('/')) {
        const rel = hostPlatform.relative(cwd, p);
        if (escapesRoot(rel) || hostPlatform.isAbsolute(rel)) return null;
        return rel;
      }
    }

    // 3. Foreign absolute path without foreignRoot: cannot resolve safely
    if (/^[a-zA-Z]:[\\/]|^\\\\/.test(p) || p.startsWith('/')) {
      return null;
    }

    // 4. Project-relative path
    const normalized =
      p.includes('\\') && hostPlatform.sep === '\\' ? p.replace(/\\/g, '/') : p;
    const posixRel = path.posix
      .normalize(normalized)
      .replace(/^\.\//, '')
      .replace(/\/$/, '');
    if (escapesRoot(posixRel)) {
      return null;
    }
    return posixRel;
  };

  const compA = toComparable(pathA);
  const compB = toComparable(pathB);

  if (compA === null || compB === null) return false;
  return compA === compB;
}
