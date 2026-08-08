import fg from 'fast-glob';

export function matchFiles(cwd: string, patterns: string[]): string[] {
  // fast-glob returns filesystem enumeration order, which can differ between
  // copies of the same tree (APFS hashes directory entries), so two identical
  // projects could process and report files in different orders. Sorting here
  // makes every consumer (passes, warnings, the report) deterministic.
  return fg
    .sync(patterns, {
      cwd,
      absolute: true,
      onlyFiles: true,
    })
    .sort();
}
