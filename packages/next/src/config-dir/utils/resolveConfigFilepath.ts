import path from 'path';
import fs from 'fs';

/**
 * Resolves a configuration filepath for dictionary files.
 *
 * @param {string} fileName - The base name of the config file to look for.
 * @param {string} [cwd] - An optional current working directory path.
 * @returns {string|undefined} - The path if found; otherwise undefined.
 */
export function resolveConfigFilepath(
  fileName: string,
  extensions: string[] = ['.ts', '.js'],
  cwd?: string,
  prefixes: string[] = ['.', './src']
): string | undefined {
  function resolvePath(pathname: string) {
    const parts = [];
    if (cwd) parts.push(cwd);
    parts.push(pathname);
    return path.resolve(...parts);
  }

  function pathExists(pathname: string) {
    return fs.existsSync(resolvePath(pathname));
  }

  // Check for file existence in the root and src directories with supported extensions
  for (const candidate of [
    ...prefixes.flatMap(
      (prefix) => extensions.map((ext) => `${prefix}/${fileName}${ext}`) // TOOD: is the / necessary after dot?
    ),
  ]) {
    if (pathExists(candidate)) {
      return candidate;
    }
  }

  // Return undefined if no file is found
  return undefined;
}
