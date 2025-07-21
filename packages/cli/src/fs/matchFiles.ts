import fg from 'fast-glob';

export function matchFiles(cwd: string, patterns: string[]): string[] {
  return fg.sync(patterns, {
    cwd,
    absolute: true,
    onlyFiles: true,
  });
}
