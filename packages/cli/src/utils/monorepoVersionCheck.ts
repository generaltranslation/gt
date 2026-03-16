import fs from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';
import YAML from 'yaml';
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

interface VersionInfo {
  version: string;
  workspaces: string[];
}

interface VersionMismatch {
  packageName: string;
  versions: VersionInfo[];
}

/**
 * Walk up from startDir to find the monorepo root.
 * Looks for pnpm-workspace.yaml or package.json with "workspaces" field.
 */
function findMonorepoRoot(startDir: string): string | null {
  let dir = startDir;
  while (true) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
      return dir;
    }

    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg.workspaces) return dir;
      } catch {
        // ignore parse errors
      }
    }

    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Get workspace glob patterns from the monorepo root.
 */
function getWorkspaceGlobs(rootDir: string): string[] {
  // Check pnpm-workspace.yaml first
  const pnpmPath = path.join(rootDir, 'pnpm-workspace.yaml');
  if (fs.existsSync(pnpmPath)) {
    try {
      const parsed = YAML.parse(fs.readFileSync(pnpmPath, 'utf8'));
      if (Array.isArray(parsed?.packages)) {
        return parsed.packages;
      }
    } catch {
      // fall through to package.json
    }
  }

  // Check package.json workspaces
  const pkgPath = path.join(rootDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (Array.isArray(pkg.workspaces)) return pkg.workspaces;
      if (Array.isArray(pkg.workspaces?.packages))
        return pkg.workspaces.packages;
    } catch {
      // ignore
    }
  }

  return [];
}

/**
 * Resolve workspace globs to actual directories that contain package.json files.
 */
function resolveWorkspaceDirs(rootDir: string, globs: string[]): string[] {
  // Filter out negation patterns and normalize
  const positiveGlobs = globs
    .filter((g) => !g.startsWith('!'))
    .map((g) => {
      // Ensure glob ends with /package.json to find workspace roots
      // e.g. "packages/*" -> "packages/*/package.json"
      const trimmed = g.endsWith('/') ? g.slice(0, -1) : g;
      return `${trimmed}/package.json`;
    });

  if (positiveGlobs.length === 0) return [];

  const matches = fg.sync(positiveGlobs, {
    cwd: rootDir,
    absolute: true,
    onlyFiles: true,
    ignore: ['**/node_modules/**'],
  });

  return matches.map((m) => path.dirname(m));
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
        const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
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
 * Check whether a workspace actually depends on a GT package
 * (directly in dependencies or devDependencies).
 */
function workspaceDependsOn(
  packageName: string,
  workspaceDir: string
): boolean {
  const pkgPath = path.join(workspaceDir, 'package.json');
  if (!fs.existsSync(pkgPath)) return false;
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    return packageName in deps;
  } catch {
    return false;
  }
}

/**
 * Scan all workspaces in a monorepo for mismatched GT package versions.
 * Returns an array of mismatches, or an empty array if everything is consistent.
 */
function findVersionMismatches(
  rootDir: string,
  workspaceDirs: string[]
): VersionMismatch[] {
  // Map: packageName -> Map<installedVersion, workspaceNames[]>
  const packageVersions = new Map<string, Map<string, string[]>>();

  for (const wsDir of workspaceDirs) {
    const wsName = getWorkspaceName(wsDir);

    for (const pkg of GT_PACKAGES) {
      if (!workspaceDependsOn(pkg, wsDir)) continue;

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
function getWorkspaceName(wsDir: string): string {
  const pkgPath = path.join(wsDir, 'package.json');
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return pkg.name ?? path.basename(wsDir);
  } catch {
    return path.basename(wsDir);
  }
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
  if (!rootDir) return; // Not in a monorepo — nothing to check

  const globs = getWorkspaceGlobs(rootDir);
  if (globs.length === 0) return;

  const workspaceDirs = resolveWorkspaceDirs(rootDir, globs);
  if (workspaceDirs.length <= 1) return; // Single workspace — no mismatches possible

  const mismatches = findVersionMismatches(rootDir, workspaceDirs);
  if (mismatches.length === 0) return; // All consistent

  logger.error(formatMismatchError(mismatches));
  process.exit(1);
}
