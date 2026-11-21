import fs from 'node:fs';
import fg from 'fast-glob';

/** Whether a file system error means the path exists but cannot be read. */
export function isPermissionError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException).code;
  return code === 'EACCES' || code === 'EPERM';
}

/**
 * Lists the files under cwd that match the patterns. With
 * `unreadableFolders`, a folder that cannot be read is skipped and its path
 * is added to that list.
 */
export function matchFiles(
  cwd: string,
  patterns: string[],
  { unreadableFolders }: { unreadableFolders?: string[] } = {}
): string[] {
  return fg.sync(patterns, {
    cwd,
    absolute: true,
    onlyFiles: true,
    ...(unreadableFolders && {
      fs: { readdirSync: skipUnreadableFolders(unreadableFolders) },
    }),
  });
}

/** Returns a readdirSync that lists an unreadable folder as empty. */
function skipUnreadableFolders(unreadableFolders: string[]) {
  function readdirSync(folder: string): string[];
  function readdirSync(
    folder: string,
    options: { withFileTypes: true }
  ): fs.Dirent[];
  function readdirSync(folder: string, options?: { withFileTypes: true }) {
    try {
      return options ? fs.readdirSync(folder, options) : fs.readdirSync(folder);
    } catch (error) {
      if (!isPermissionError(error)) throw error;
      unreadableFolders.push(folder);
      return [];
    }
  }
  return readdirSync;
}
