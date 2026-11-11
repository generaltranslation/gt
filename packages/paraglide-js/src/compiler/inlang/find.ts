import fsp from 'node:fs/promises';
import path from 'node:path';

/** The `*.inlang` directories directly inside `directories`, in their order. */
export async function findInlangProjects(
  directories: readonly string[]
): Promise<string[]> {
  const found = await Promise.all(directories.map(inlangDirectoriesIn));

  return found.flat();
}

async function inlangDirectoriesIn(directory: string): Promise<string[]> {
  const entries = await fsp
    .readdir(directory, { withFileTypes: true })
    .catch(() => []);

  return entries
    .filter((entry) => entry.isDirectory() && entry.name.endsWith('.inlang'))
    .map((entry) => path.join(directory, entry.name))
    .sort();
}
