import path from 'node:path';

/**
 * Converts native Windows path separators to the slash-separated form expected
 * by glob matchers and portable path comparisons. POSIX backslashes are glob
 * escapes (or valid filename characters), so they must be preserved.
 */
export function toPosixPath(filePath: string): string {
  if (path.sep !== '\\') return filePath;
  return filePath.replace(/\\/g, '/');
}
