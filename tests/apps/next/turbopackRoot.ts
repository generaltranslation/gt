import { createRequire } from 'node:module';
import { dirname, parse, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

function getCommonAncestor(paths: string[]): string {
  const [firstPath, ...remainingPaths] = paths.map((entry) =>
    entry.split(/[\\/]+/)
  );
  const commonParts = [...firstPath];

  for (const currentPath of remainingPaths) {
    for (let index = 0; index < commonParts.length; index++) {
      if (commonParts[index] !== currentPath[index]) {
        commonParts.length = index;
        break;
      }
    }
  }

  const commonPath = commonParts.join(sep);
  if (commonPath.endsWith(':')) return `${commonPath}${sep}`;
  return commonPath || parse(paths[0]).root;
}

export function getTurbopackRoot(configUrl: string): string {
  const require = createRequire(configUrl);
  const appRoot = dirname(fileURLToPath(configUrl));
  const nextRoot = dirname(require.resolve('next/package.json'));

  return getCommonAncestor([appRoot, nextRoot]);
}
