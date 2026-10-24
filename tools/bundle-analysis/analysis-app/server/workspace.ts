import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../..'
);
export const packagesDir = join(repoRoot, 'packages');
export const examplesDir = join(repoRoot, 'tools/bundle-analysis/examples');

export interface WorkspacePackage {
  name: string;
  dir: string;
}

/** Every package under packages/ with its published name. */
export function readWorkspacePackages(root = packagesDir): WorkspacePackage[] {
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(root, entry.name))
    .filter((dir) => existsSync(join(dir, 'package.json')))
    .map((dir) => ({
      name: JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
        .name as string,
      dir,
    }));
}

export interface ModuleOwner {
  /** npm package name, `(app)` for example source, or a bracketed bucket. */
  pkg: string;
  /** Path inside the package (or app), using forward slashes. */
  path: string;
  /** True for General Translation packages. */
  gt: boolean;
}

export const APP = '(app)';
export const UNMAPPED = '(unmapped)';
export const BUNDLER = '(bundler)';

/** Names of GT packages that are not in this workspace's packages/ dir. */
const GT_NAME = /^(generaltranslation|gt|gt-.+|@generaltranslation\/.+)$/;

/** Classifies a resolved source-map source by the package that owns it. */
export function createClassifier(packages: WorkspacePackage[], appDir: string) {
  const dirs = packages
    .map((pkg) => ({ ...pkg, prefix: pkg.dir + sep }))
    .sort((a, b) => b.prefix.length - a.prefix.length);
  const gtNames = new Set(packages.map((pkg) => pkg.name));
  const appPrefix = appDir + sep;

  return function classify(source: string | null): ModuleOwner {
    if (source === null) return { pkg: UNMAPPED, path: '', gt: false };
    const normalized = source.split(sep).join('/');

    const nodeModules = normalized.lastIndexOf('/node_modules/');
    if (nodeModules !== -1) {
      const rest = normalized.slice(nodeModules + '/node_modules/'.length);
      const parts = rest.split('/');
      const nameLength = parts[0]?.startsWith('@') ? 2 : 1;
      const pkg = parts.slice(0, nameLength).join('/');
      return {
        pkg,
        path: parts.slice(nameLength).join('/'),
        gt: gtNames.has(pkg) || GT_NAME.test(pkg),
      };
    }

    for (const workspacePackage of dirs) {
      if (source.startsWith(workspacePackage.prefix)) {
        return {
          pkg: workspacePackage.name,
          path: relative(workspacePackage.dir, source).split(sep).join('/'),
          gt: true,
        };
      }
    }

    if (source.startsWith(appPrefix)) {
      const path = relative(appDir, source).split(sep).join('/');
      // Virtual ids that a bundler wrote relative to its own output dir.
      if (/^(\.next|dist|\.output)\//.test(path)) {
        const virtual = path.indexOf('[');
        return {
          pkg: BUNDLER,
          path: virtual === -1 ? path : path.slice(virtual),
          gt: false,
        };
      }
      return { pkg: APP, path, gt: false };
    }

    // Virtual modules (\0 ids, [turbopack] runtime, rolldown:runtime, ...).
    const label = normalized.replace(/^\0/, '').replace(/^\.?\/+/, '');
    return { pkg: BUNDLER, path: label || 'runtime', gt: false };
  };
}
