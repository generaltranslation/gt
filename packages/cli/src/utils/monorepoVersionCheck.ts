import fs from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';
import chalk from 'chalk';
import { logger } from '../console/logger.js';
import { Libraries, type GTLibrary } from '../types/libraries.js';
import { resolveConfig } from '../config/resolveConfig.js';
import { PACKAGE_VERSION } from '../generated/version.js';

interface PackageJson {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
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

interface SyncedVersionGroup {
  packages: readonly GTLibrary[];
  minVersion?: string;
}

interface VersionRange {
  minInclusive: string;
  maxExclusive: string;
}

interface RuntimeCompatibilityRule {
  cli: VersionRange;
  runtimes: Partial<Record<GTLibrary, VersionRange>>;
}

interface RuntimeCompatibilityMismatch {
  packageName: string;
  version: string;
  workspace: string;
  compatibleRange: VersionRange;
}

const SYNCED_VERSION_GROUPS: readonly SyncedVersionGroup[] = [
  {
    packages: [Libraries.GT_REACT, Libraries.GT_REACT_NATIVE],
    minVersion: '10.19.1',
  },
];

const CLI_RUNTIME_COMPATIBILITY: readonly RuntimeCompatibilityRule[] = [
  {
    cli: { minInclusive: '2.0.0', maxExclusive: '3.0.0' },
    runtimes: {
      [Libraries.GT_REACT]: {
        minInclusive: '10.0.0',
        maxExclusive: '12.0.0',
      },
      [Libraries.GT_NEXT]: {
        minInclusive: '6.0.0',
        maxExclusive: '12.0.0',
      },
      [Libraries.GT_REACT_NATIVE]: {
        minInclusive: '10.0.0',
        maxExclusive: '12.0.0',
      },
      [Libraries.GT_NODE]: {
        minInclusive: '0.6.0',
        maxExclusive: '2.0.0',
      },
      [Libraries.GT_I18N]: {
        minInclusive: '0.8.0',
        maxExclusive: '2.0.0',
      },
      [Libraries.GT_REACT_CORE]: {
        minInclusive: '1.0.0',
        maxExclusive: '12.0.0',
      },
      [Libraries.GT_TANSTACK_START]: {
        minInclusive: '10.0.0',
        maxExclusive: '12.0.0',
      },
    },
  },
];

const LOCKFILES = [
  'pnpm-lock.yaml',
  'package-lock.json',
  'yarn.lock',
  'bun.lock',
  'bun.lockb',
  'deno.lock',
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
  });

  return [...new Set(matches.map((m) => path.dirname(m)))];
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
  const deps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
    ...pkg.peerDependencies,
  };
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
      mismatches.push({
        packageName,
        versions: getSortedVersionInfo(versionMap),
      });
    }
  }

  return [
    ...mismatches,
    ...findSyncedPackageVersionMismatches(packageVersions, libraries),
  ];
}

function findRuntimeCompatibilityMismatches(
  workspaceDirs: string[],
  readPkgJson: PackageJsonReader,
  libraries: readonly GTLibrary[],
  cliVersion: string
): RuntimeCompatibilityMismatch[] {
  const compatibilityRule = CLI_RUNTIME_COMPATIBILITY.find((rule) =>
    versionSpecifierIntersectsRange(cliVersion, rule.cli)
  );
  if (!compatibilityRule) return [];

  const mismatches: RuntimeCompatibilityMismatch[] = [];
  for (const wsDir of workspaceDirs) {
    const wsName = getWorkspaceName(wsDir, readPkgJson);

    for (const packageName of libraries) {
      const compatibleRange = compatibilityRule.runtimes[packageName];
      if (!compatibleRange) continue;

      const version = getDeclaredVersion(packageName, wsDir, readPkgJson);
      if (!version) continue;
      if (versionSpecifierIntersectsRange(version, compatibleRange)) continue;

      mismatches.push({
        packageName,
        version,
        workspace: wsName,
        compatibleRange,
      });
    }
  }

  return mismatches;
}

/**
 * Find mismatches between package names that must stay on the same version.
 */
function findSyncedPackageVersionMismatches(
  packageVersions: Map<string, Map<string, string[]>>,
  libraries: readonly GTLibrary[]
): VersionMismatch[] {
  const enabledLibraries = new Set(libraries);
  const mismatches: VersionMismatch[] = [];

  for (const group of SYNCED_VERSION_GROUPS) {
    const enabledGroupPackages = group.packages.filter((pkg) =>
      enabledLibraries.has(pkg)
    );
    if (enabledGroupPackages.length <= 1) continue;

    const presentGroupPackages = enabledGroupPackages.filter((pkg) =>
      packageVersions.has(pkg)
    );
    if (presentGroupPackages.length <= 1) continue;

    const versionMap = new Map<string, string[]>();
    for (const packageName of presentGroupPackages) {
      const packageVersionMap = packageVersions.get(packageName)!;

      for (const [version, workspaces] of packageVersionMap) {
        const locations = versionMap.get(version) ?? [];
        locations.push(
          ...workspaces.map((workspace) => `${packageName} in ${workspace}`)
        );
        versionMap.set(version, locations);
      }
    }

    if (
      versionMap.size > 1 &&
      shouldCheckSyncedVersionGroup(group, versionMap)
    ) {
      mismatches.push({
        packageName: presentGroupPackages.join(' / '),
        versions: getSortedVersionInfo(versionMap),
      });
    }
  }

  return mismatches;
}

function shouldCheckSyncedVersionGroup(
  group: SyncedVersionGroup,
  versionMap: Map<string, string[]>
): boolean {
  const { minVersion } = group;
  if (!minVersion) return true;

  return [...versionMap.keys()].some((version) =>
    isVersionAtLeast(version, minVersion)
  );
}

function isVersionAtLeast(version: string, minVersion: string): boolean {
  const parsedVersion = parseSemverVersion(version);
  const parsedMinVersion = parseSemverVersion(minVersion);
  if (!parsedVersion || !parsedMinVersion) return true;

  return compareSemverVersions(parsedVersion, parsedMinVersion) >= 0;
}

function versionSpecifierIntersectsRange(
  version: string,
  range: VersionRange
): boolean {
  const parsedVersions = parseSemverVersions(version);
  if (parsedVersions.length === 0) return true;

  const minVersion = parseSemverVersion(range.minInclusive);
  const maxVersion = parseSemverVersion(range.maxExclusive);
  if (!minVersion || !maxVersion) return true;

  return parsedVersions.some(
    (parsedVersion) =>
      compareSemverVersions(parsedVersion, minVersion) >= 0 &&
      compareSemverVersions(parsedVersion, maxVersion) < 0
  );
}

function parseSemverVersion(
  version: string
): { major: number; minor: number; patch: number } | null {
  const match = version
    .trim()
    .match(/^[\^~<>=\s]*(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!match) return null;

  return {
    major: Number(match[1]),
    minor: Number(match[2] ?? 0),
    patch: Number(match[3] ?? 0),
  };
}

function parseSemverVersions(
  version: string
): { major: number; minor: number; patch: number }[] {
  const matches = version.matchAll(/(\d+)(?:\.(\d+))?(?:\.(\d+))?/g);
  return [...matches].map((match) => ({
    major: Number(match[1]),
    minor: Number(match[2] ?? 0),
    patch: Number(match[3] ?? 0),
  }));
}

function compareSemverVersions(
  a: { major: number; minor: number; patch: number },
  b: { major: number; minor: number; patch: number }
): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

function getSortedVersionInfo(
  versionMap: Map<string, string[]>
): VersionInfo[] {
  const versions: VersionInfo[] = [];
  for (const [version, workspaces] of versionMap) {
    versions.push({ version, workspaces });
  }
  // Sort by version descending so the latest appears first
  versions.sort((a, b) =>
    b.version.localeCompare(a.version, undefined, { numeric: true })
  );
  return versions;
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

function formatCompatibilityError(
  mismatches: RuntimeCompatibilityMismatch[],
  cliVersion: string
): string {
  const lines: string[] = [
    chalk.red.bold('Incompatible GT package versions detected!'),
    '',
    chalk.yellow(
      `The installed gt CLI version (${cliVersion}) is not compatible with the following GT runtime package versions.`
    ),
    '',
  ];

  for (const mismatch of mismatches) {
    lines.push(
      `  ${chalk.white.bold(mismatch.packageName)} ${chalk.cyan(
        mismatch.version
      )} ${chalk.dim('←')} ${mismatch.workspace}`
    );
    lines.push(
      `    Compatible range for gt ${cliVersion}: ${chalk.green(
        formatVersionRange(mismatch.compatibleRange)
      )}`
    );
  }

  lines.push(
    '',
    chalk.yellow(
      'Please upgrade gt and your GT runtime packages to compatible versions, then reinstall.'
    ),
    '',
    chalk.dim(
      'To skip this check, use --skip-version-check or set "skipVersionCheck": true in gt.config.json.\n'
    )
  );

  return lines.join('\n');
}

function formatVersionRange(range: VersionRange): string {
  return `>=${range.minInclusive} <${range.maxExclusive}`;
}

/**
 * Run the monorepo version consistency check.
 * If mismatched GT package versions are found, logs an error and exits with code 1.
 * Silently returns if not in a monorepo or if all versions are consistent.
 * Can be skipped via the --skip-version-check flag or "skipVersionCheck": true in gt.config.json.
 */
export function checkMonorepoVersionConsistency(
  libraries: readonly GTLibrary[],
  options: { cliVersion?: string } = {}
): void {
  const cwd = process.cwd();
  const cliVersion = options.cliVersion ?? PACKAGE_VERSION;

  // Check if skipped via config
  const resolved = resolveConfig(cwd);
  if (resolved?.config?.skipVersionCheck) return;

  const rootDir = findMonorepoRoot(cwd);
  if (!rootDir) return; // No lockfile found — nothing to check

  const workspaceDirs = scanForPackageDirs(rootDir);
  if (workspaceDirs.length === 0) return; // No package workspaces found

  const readPkgJson = createPackageJsonReader();
  const mismatches =
    workspaceDirs.length > 1
      ? findVersionMismatches(workspaceDirs, readPkgJson, libraries)
      : [];
  const compatibilityMismatches = findRuntimeCompatibilityMismatches(
    workspaceDirs,
    readPkgJson,
    libraries,
    cliVersion
  );
  if (mismatches.length === 0 && compatibilityMismatches.length === 0) return; // All consistent

  logger.error(
    [
      ...(mismatches.length > 0 ? [formatMismatchError(mismatches)] : []),
      ...(compatibilityMismatches.length > 0
        ? [formatCompatibilityError(compatibilityMismatches, cliVersion)]
        : []),
    ].join('\n')
  );
  process.exit(1);
}
