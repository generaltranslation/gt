import fg from 'fast-glob';

export const IGNORED_PATTERNS = ['**/.*', '**/.*/**'];

export function matchFiles(cwd: string, patterns: string[]): string[] {
  return fg.sync(patterns, {
    cwd,
    absolute: true,
    onlyFiles: true,
    ignore: IGNORED_PATTERNS,
  });
}
