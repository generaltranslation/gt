import fg from 'fast-glob';

export function matchFiles(
  cwd: string,
  patterns: string[],
  { suppressErrors = false }: { suppressErrors?: boolean } = {}
): string[] {
  return fg.sync(patterns, {
    cwd,
    absolute: true,
    onlyFiles: true,
    suppressErrors,
  });
}
