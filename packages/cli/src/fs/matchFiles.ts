import fs from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';

export type MatchFilesOptions = {
  /** Whether glob traversal may enter symbolic-link directories. */
  followSymbolicLinks?: boolean;
  /** Whether every resolved file must remain inside the real cwd boundary. */
  stayWithinCwd?: boolean;
};

/** Resolves source globs to absolute file paths. */
export function matchFiles(
  cwd: string,
  patterns: string[],
  options: MatchFilesOptions = {}
): string[] {
  const matches = fg.sync(patterns, {
    cwd,
    absolute: true,
    followSymbolicLinks: options.followSymbolicLinks ?? true,
    onlyFiles: true,
  });
  if (!options.stayWithinCwd) return matches;

  const realRoot = tryRealpath(cwd);
  if (!realRoot) return [];
  return matches.filter((file) => {
    const realFile = tryRealpath(file);
    if (!realFile) return false;
    const relative = path.relative(realRoot, realFile);
    return (
      relative !== '' &&
      relative !== '..' &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative)
    );
  });
}

function tryRealpath(filepath: string): string | undefined {
  try {
    return fs.realpathSync(filepath);
  } catch {
    return undefined;
  }
}
