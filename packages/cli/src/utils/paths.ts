import path from 'node:path';

const POSIX_GLOB_SYMBOLS_RE =
  /(\\?)([()*?[\]{|}]|^!|[!+@](?=\()|\\(?![!()*+?@[\]{|}]))/g;

function escapePosixGlobPath(filePath: string): string {
  return filePath.replace(POSIX_GLOB_SYMBOLS_RE, '\\$2');
}

/**
 * Converts a concrete native filesystem path to slash-separated form.
 * POSIX backslashes are valid filename characters, so they must be preserved.
 */
export function toPosixPath(filePath: string): string {
  if (path.sep !== '\\') return filePath;
  return filePath.replace(/\\/g, '/');
}

/**
 * Converts separators in a user-authored glob while preserving backslashes
 * that escape Windows glob metacharacters.
 */
export function toPosixGlob(pattern: string): string {
  if (path.sep !== '\\') return pattern;
  return pattern.replace(/\\(?![()[\]{}]|[!+@](?=\())/g, '/');
}

/**
 * Resolves a user-authored glob without passing its escape characters through
 * the platform path resolver. The cwd is resolved separately as a concrete
 * path, then joined using the slash syntax expected by glob matchers.
 */
export function resolvePosixGlob(cwd: string, pattern: string): string {
  if (path.isAbsolute(pattern)) return toPosixGlob(pattern);

  const absoluteCwd = escapePosixGlobPath(toPosixPath(path.resolve(cwd)));
  const normalizedPattern = toPosixGlob(pattern).replace(/^\.\/+/, '');
  if (!normalizedPattern) return absoluteCwd;

  const base = absoluteCwd.replace(/\/+$/, '');
  return `${base}/${normalizedPattern}`;
}
