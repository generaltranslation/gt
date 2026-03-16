import fs from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';
import chalk from 'chalk';
import { logger } from '../console/logger.js';

/**
 * GT packages to check for version consistency across a monorepo.
 */
const GT_PACKAGES = [
  'gt-next',
  'gt-react',
  'gt-react-native',
  'gt-node',
  'gt-i18n',
  '@generaltranslation/react-core',
  'generaltranslation',
  '@generaltranslation/supported-locales',
  '@generaltranslation/compiler',
  '@generaltranslation/next-internal',
];

interface PackageJson {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface VersionInfo {
  version: string;
  workspaces: string[];
}

interface VersionMismatch {
  packageName: string;
  versions: VersionInfo[];
}

type PackageJsonReader = (workspaceDir: string) => PackageJson | null;

const LOCKFILES = [
  'pnpm-lock.yaml',
  'package-lock.json',
  'yarn.lock',
  'bun.lock',
  'bun.lockb',
];

/**
 * Walk up from startDir to find the monorepo root by looking for a lockfile.
 */
function findMonorepoRoot(startDir: string): string | null {
  let dir = startDir;
  while (true) {
    if (LOCKFILES.some((lf) => fs.existsSync(path.join(dir, lf)))) {
      return dir;
    }

    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Scan for all directories containing package.json under the root.
 */
function scanForPackageDirs(rootDir: string): string[] {
  const matches = fg.sync('**/package.json', {
    cwd: rootDir,
    absolute: true,
    onlyFiles: true,
    ignore: ['**/node_modules/**'],
    deep: 3,
  });

  return matches.map((m) => path.dirname(m)).filter((dir) => dir !== rootDir);
}

/**
 * Get the installed version of a package from a workspace directory.
 * Checks the workspace's own node_modules first, then walks up to the monorepo root.
 */
function getInstalledVersion(
  packageName: string,
  workspaceDir: string,
  monorepoRoot: string
): string | null {
  let dir = workspaceDir;
  while (true) {
    const pkgJsonPath = path.join(
      dir,
      'node_modules',
      packageName,
      'package.json'
    );
    if (fs.existsSync(pkgJsonPath)) {
      try {
        const pkg = JSON.parse(
          fs.readFileSync(pkgJsonPath, 'utf8')
        ) as PackageJson;
        return pkg.version ?? null;
      } catch {
        return null;
      }
    }

    // Don't walk past the monorepo root
    if (dir === monorepoRoot) return null;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Creates a cached reader for workspace package.json files.
 * Cache is scoped to a single check invocation to avoid stale data.
 */
function createPackageJsonReader(): PackageJsonReader {
  const cache = new Map<string, PackageJson | null>();
  return (workspaceDir: string) => {
    if (cache.has(workspaceDir)) return cache.get(workspaceDir) ?? null;
    const pkgPath = path.join(workspaceDir, 'package.json');
    if (!fs.existsSync(pkgPath)) {
      cache.set(workspaceDir, null);
      return null;
    }
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as PackageJson;
      cache.set(workspaceDir, pkg);
      return pkg;
    } catch {
      cache.set(workspaceDir, null);
      return null;
    }
  };
}

/**
 * Check whether a workspace actually depends on a GT package
 * (directly in dependencies or devDependencies).
 */
function workspaceDependsOn(
  packageName: string,
  workspaceDir: string,
  readPkgJson: PackageJsonReader
): boolean {
  const pkg = readPkgJson(workspaceDir);
  if (!pkg) return false;
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  return packageName in deps;
}

/**
 * Scan all workspaces in a monorepo for mismatched GT package versions.
 * Returns an array of mismatches, or an empty array if everything is consistent.
 */
function findVersionMismatches(
  rootDir: string,
  workspaceDirs: string[],
  readPkgJson: PackageJsonReader
): VersionMismatch[] {
  // Map: packageName -> Map<installedVersion, workspaceNames[]>
  const packageVersions = new Map<string, Map<string, string[]>>();

  for (const wsDir of workspaceDirs) {
    const wsName = getWorkspaceName(wsDir, readPkgJson);

    for (const pkg of GT_PACKAGES) {
      if (!workspaceDependsOn(pkg, wsDir, readPkgJson)) continue;

      const version = getInstalledVersion(pkg, wsDir, rootDir);
      if (!version) continue;

      if (!packageVersions.has(pkg)) {
        packageVersions.set(pkg, new Map());
      }
      const versionMap = packageVersions.get(pkg)!;
      if (!versionMap.has(version)) {
        versionMap.set(version, []);
      }
      versionMap.get(version)!.push(wsName);
    }
  }

  const mismatches: VersionMismatch[] = [];
  for (const [packageName, versionMap] of packageVersions) {
    if (versionMap.size > 1) {
      const versions: VersionInfo[] = [];
      for (const [version, workspaces] of versionMap) {
        versions.push({ version, workspaces });
      }
      // Sort by version descending so the latest appears first
      versions.sort((a, b) =>
        b.version.localeCompare(a.version, undefined, { numeric: true })
      );
      mismatches.push({ packageName, versions });
    }
  }

  return mismatches;
}

/**
 * Get a human-readable name for a workspace directory.
 */
function getWorkspaceName(
  wsDir: string,
  readPkgJson: PackageJsonReader
): string {
  const pkg = readPkgJson(wsDir);
  return pkg?.name ?? path.basename(wsDir);
}

/**
 * Format version mismatches into a human-readable error message.
 */
function formatMismatchError(mismatches: VersionMismatch[]): string {
  const lines: string[] = [
    chalk.red.bold(
      'Mismatched GT package versions detected across your monorepo!'
    ),
    '',
    chalk.yellow(
      'Please update all workspaces to use the same version of each GT package, then reinstall.'
    ),
    '',
  ];

  for (const mismatch of mismatches) {
    lines.push(chalk.white.bold(`  ${mismatch.packageName}:`));
    for (const { version, workspaces } of mismatch.versions) {
      lines.push(
        `    ${chalk.cyan(version)} ${chalk.dim('←')} ${workspaces.join(', ')}`
      );
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Run the monorepo version consistency check.
 * If mismatched GT package versions are found, logs an error and exits with code 1.
 * Silently returns if not in a monorepo or if all versions are consistent.
 */
export function checkMonorepoVersionConsistency(): void {
  const cwd = process.cwd();
  const rootDir = findMonorepoRoot(cwd);
  if (!rootDir) return; // No lockfile found — nothing to check

  const workspaceDirs = scanForPackageDirs(rootDir);
  if (workspaceDirs.length <= 1) return; // Single package — no mismatches possible

  const readPkgJson = createPackageJsonReader();
  const mismatches = findVersionMismatches(rootDir, workspaceDirs, readPkgJson);
  if (mismatches.length === 0) return; // All consistent

  logger.error(formatMismatchError(mismatches));
  process.exit(1);
}
