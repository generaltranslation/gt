import path from 'node:path';
import { ResolverFactory } from 'oxc-resolver';

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
