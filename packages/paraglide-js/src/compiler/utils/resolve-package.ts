import path from 'node:path';
import { ResolverFactory } from 'oxc-resolver';
import { readJsonObject, type JsonObject } from './json.js';

/**
 * Resolves packages the way Node imports them: `exports` with the `import`
 * condition first (a CommonJS build hides named exports behind `default`),
 * then `require`, then `main`. Symlinks resolve to real paths (pnpm).
 */
const resolver = new ResolverFactory({
  conditionNames: ['node', 'import', 'module', 'default', 'require'],
  mainFields: ['module', 'main'],
  extensions: ['.mjs', '.js', '.cjs', '.json'],
});

/**
 * The file `specifier` (a package or a package subpath, like `svelte/compiler`)
 * resolves to when imported from a file in `from`; undefined if not installed.
 */
export async function resolvePackage(
  from: string,
  specifier: string
): Promise<string | undefined> {
  // The resolver takes the importing file, not its directory.
  const importer = path.join(from, '_.js');
  const result = await resolver.resolveFileAsync(importer, specifier);

  return result.path;
}

/** The manifest of the package `name` that holds `file`, and its directory; undefined if none does. */
export async function packageManifest(
  file: string,
  name: string
): Promise<{ directory: string; manifest: JsonObject } | undefined> {
  for (
    let directory = path.dirname(file);
    ;
    directory = path.dirname(directory)
  ) {
    const manifest = await readJsonObject(path.join(directory, 'package.json'));
    if (manifest?.name === name) return { directory, manifest };

    const isFilesystemRoot = path.dirname(directory) === directory;
    if (isFilesystemRoot) return undefined;
  }
}

/** A manifest's `version`; `?` if it has none. */
export function versionOf(manifest: JsonObject): string {
  return typeof manifest.version === 'string' ? manifest.version : '?';
}
