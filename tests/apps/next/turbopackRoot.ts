import { createRequire } from 'node:module';
import { dirname, join, parse, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

function getCommonAncestor(paths: string[]): string {
  if (paths.length === 0) {
    throw new Error('Unable to set turbopack.root without paths.');
  }

  const normalizedPaths = paths.map((entry) => resolve(entry));
  const firstRoot = parse(normalizedPaths[0]!).root;
  const remainingRoots = normalizedPaths
    .slice(1)
    .map((entry) => parse(entry).root);
  const firstRootKey = normalizeRoot(firstRoot);
  const mismatchedRoot = remainingRoots.find(
    (root) => normalizeRoot(root) !== firstRootKey
  );

  if (mismatchedRoot != null) {
    throw new Error(
      `Unable to set turbopack.root because paths are on different filesystem roots: ${firstRoot}, ${mismatchedRoot}. ` +
        `Configure pnpm's store on the same drive as the app, or disable the global virtual store for this install.`
    );
  }

  const [firstPath, ...remainingPaths] = normalizedPaths.map((entry) =>
    relative(firstRoot, entry).split(sep).filter(Boolean)
  );
  const commonParts = [...firstPath!];

  for (const currentPath of remainingPaths) {
    for (let index = 0; index < commonParts.length; index++) {
      if (commonParts[index] !== currentPath[index]) {
        commonParts.length = index;
        break;
      }
    }
  }

  return commonParts.length === 0 ? firstRoot : join(firstRoot, ...commonParts);
}

function normalizeRoot(root: string): string {
  return process.platform === 'win32' ? root.toLowerCase() : root;
}

export function getTurbopackRoot(configUrl: string): string {
  const require = createRequire(configUrl);
  const appRoot = dirname(fileURLToPath(configUrl));
  const nextRoot = dirname(require.resolve('next/package.json'));

  return getCommonAncestor([appRoot, nextRoot]);
}
