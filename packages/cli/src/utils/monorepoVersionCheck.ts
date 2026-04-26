import fs from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';
import chalk from 'chalk';
import { logger } from '../console/logger.js';
import type { GTLibrary } from '../types/libraries.js';
import { resolveConfig } from '../config/resolveConfig.js';

interface PackageJson {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  workspaces?: string[] | { packages: string[] };
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
  'deno.lock',
];

function hasWorkspaceConfig(dir: string): boolean {
  if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return true;
  if (fs.existsSync(path.join(dir, 'lerna.json'))) return true;
  const pkgPath = path.join(dir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as PackageJson;
      if (pkg.workspaces) return true;
    } catch {
      // ignore parse errors
    }
  }
  return false;
}

/**
 * Walk up from startDir to find the monorepo root by looking for a lockfile
 * combined with workspace configuration.
 */
function findMonorepoRoot(startDir: string): string | null {
  let dir = startDir;
  while (true) {
    if (
      LOCKFILES.some((lf) => fs.existsSync(path.join(dir, lf))) &&
      hasWorkspaceConfig(dir)
    ) {
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
  });

  return matches.map((m) => path.dirname(m)).filter((dir) => dir !== rootDir);
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
 * Check if a version specifier is a real semver version
 */
function isSemverSpecifier(version: string): boolean {
  return /^[\^~>=<*]?\d/.test(version);
}

/**
 * Get the declared version specifier for a GT package from a workspace's package.json.
 * Returns null if the package is not found or uses a non-semver protocol
 * (e.g. workspace:*, link:, file:, etc.)
 */
function getDeclaredVersion(
  packageName: string,
  workspaceDir: string,
  readPkgJson: PackageJsonReader
): string | null {
  const pkg = readPkgJson(workspaceDir);
  if (!pkg) return null;
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const version = deps[packageName];
  if (!version || !isSemverSpecifier(version)) return null;
  return version;
}

/**
 * Scan all packages for mismatched GT package version specifiers.
 * Compares the declared versions in each package.json directly.
 */
function findVersionMismatches(
  workspaceDirs: string[],
  readPkgJson: PackageJsonReader,
  libraries: readonly GTLibrary[]
): VersionMismatch[] {
  // Map: packageName -> Map<versionSpecifier, workspaceNames[]>
  const packageVersions = new Map<string, Map<string, string[]>>();

  for (const wsDir of workspaceDirs) {
    const wsName = getWorkspaceName(wsDir, readPkgJson);

    for (const pkg of libraries) {
      const version = getDeclaredVersion(pkg, wsDir, readPkgJson);
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

  lines.push(
    chalk.dim(
      'To skip this check, use --skip-version-check or set "skipVersionCheck": true in gt.config.json.\n'
    )
  );

  return lines.join('\n');
}

/**
 * Run the monorepo version consistency check.
 * If mismatched GT package versions are found, logs an error and exits with code 1.
 * Silently returns if not in a monorepo or if all versions are consistent.
 * Can be skipped via the --skip-version-check flag or "skipVersionCheck": true in gt.config.json.
 */
export function checkMonorepoVersionConsistency(
  libraries: readonly GTLibrary[]
): void {
  const cwd = process.cwd();

  // Check if skipped via config
  const resolved = resolveConfig(cwd);
  if (resolved?.config?.skipVersionCheck) return;

  const rootDir = findMonorepoRoot(cwd);
  if (!rootDir) return; // No lockfile found — nothing to check

  logger.debug(chalk.dim(`Monorepo workspace root found at ${rootDir}`));

  const workspaceDirs = scanForPackageDirs(rootDir);
  if (workspaceDirs.length <= 1) return; // Single package — no mismatches possible

  const readPkgJson = createPackageJsonReader();
  const mismatches = findVersionMismatches(
    workspaceDirs,
    readPkgJson,
    libraries
  );
  if (mismatches.length === 0) return; // All consistent

  logger.error(formatMismatchError(mismatches));
  process.exit(1);
}
