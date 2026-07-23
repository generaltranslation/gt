import { createRequire } from 'node:module';
import { dirname, join, parse, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDiagnosticMessage } from 'generaltranslation/internal';

function normalizeRoot(root: string): string {
  return process.platform === 'win32' ? root.toLowerCase() : root;
}

function getCommonAncestor(paths: string[]): string {
  const normalizedPaths = paths.map((entry) => resolve(entry));
  const firstRoot = parse(normalizedPaths[0]!).root;
  const mismatchedRoot = normalizedPaths
    .slice(1)
    .map((entry) => parse(entry).root)
    .find((root) => normalizeRoot(root) !== normalizeRoot(firstRoot));

  if (mismatchedRoot != null) {
    throw new Error(
      createDiagnosticMessage({
        source: 'gt-next-sanity-example',
        severity: 'Error',
        whatHappened: 'Turbopack could not determine a shared root',
        why: 'the app and pnpm store are on different drives',
        fix: 'Configure the pnpm store on the same drive as the app',
        wayOut: 'disable the global virtual store for this install',
      })
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

export function getTurbopackRoot(configUrl: string): string {
  const require = createRequire(configUrl);
  const appRoot = dirname(fileURLToPath(configUrl));
  const nextRoot = dirname(require.resolve('next/package.json'));

  return getCommonAncestor([appRoot, nextRoot]);
}
