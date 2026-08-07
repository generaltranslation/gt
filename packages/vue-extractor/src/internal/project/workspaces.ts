import fs from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';
import { parse as parseYaml } from 'yaml';

/** Dependency fields that can declare a runtime available to one package. */
const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
] as const;

/** Minimal package manifest shape used by project discovery. */
export type JavaScriptPackageManifest = {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  workspaces?: string[] | { packages?: string[] };
};

/** A validated workspace package and its parsed manifest. */
export type DeclaredWorkspacePackage = {
  directory: string;
  manifest: JavaScriptPackageManifest;
};

/** Per-extraction cache that avoids traversing the same workspace repeatedly. */
export type WorkspaceDiscoveryCache = Map<
  string,
  { manifestWorkspaces: string; packages: DeclaredWorkspacePackage[] }
>;

/** Creates an isolated workspace cache for one detection or extraction call. */
export function createWorkspaceDiscoveryCache(): WorkspaceDiscoveryCache {
  return new Map();
}

/**
 * Reads declared workspace packages without following paths outside the root.
 *
 * A valid `pnpm-workspace.yaml` is authoritative over `package.json` because
 * pnpm uses that file to include and exclude packages. Malformed workspace
 * metadata is treated as no optional workspaces; it never hides a known root
 * application or causes extraction to traverse the filesystem recursively.
 */
export function readDeclaredWorkspacePackages(
  cwd: string,
  rootManifest: JavaScriptPackageManifest,
  cache: WorkspaceDiscoveryCache
): DeclaredWorkspacePackage[] {
  const cacheKey = path.resolve(cwd);
  const manifestWorkspaces = JSON.stringify(rootManifest.workspaces ?? null);
  const cached = cache.get(cacheKey);
  if (cached?.manifestWorkspaces === manifestWorkspaces) {
    return cached.packages;
  }

  const pnpmPatterns = getPnpmWorkspacePatterns(cwd);
  const patterns =
    pnpmPatterns ?? getPackageJsonWorkspacePatterns(rootManifest);
  const manifestPatterns = [...new Set(patterns.map(toManifestPattern))].filter(
    (pattern): pattern is string => pattern !== null
  );
  if (!manifestPatterns.some((pattern) => !pattern.startsWith('!'))) {
    return cacheWorkspacePackages(cache, cacheKey, manifestWorkspaces, []);
  }

  const realRoot = readRealPath(cwd);
  if (!realRoot) {
    return cacheWorkspacePackages(cache, cacheKey, manifestWorkspaces, []);
  }

  let packagePaths: string[];
  try {
    packagePaths = fg.sync(manifestPatterns, {
      absolute: true,
      cwd,
      followSymbolicLinks: false,
      ignore: ['**/node_modules/**'],
      onlyFiles: true,
      unique: true,
    });
  } catch {
    return cacheWorkspacePackages(cache, cacheKey, manifestWorkspaces, []);
  }

  const rootPackagePath = path.resolve(cwd, 'package.json');
  const packages = packagePaths.flatMap((packagePath) => {
    const absolutePath = path.resolve(packagePath);
    if (
      absolutePath === rootPackagePath ||
      !isWithinRoot(cwd, absolutePath) ||
      absolutePath.split(path.sep).includes('node_modules')
    ) {
      return [];
    }

    const realPackagePath = readRealPath(absolutePath);
    if (
      !realPackagePath ||
      !isWithinRoot(realRoot, realPackagePath) ||
      realPackagePath.split(path.sep).includes('node_modules')
    ) {
      return [];
    }
    const manifest = readJavaScriptPackageManifest(realPackagePath);
    return manifest
      ? [{ directory: path.dirname(absolutePath), manifest }]
      : [];
  });
  return cacheWorkspacePackages(cache, cacheKey, manifestWorkspaces, packages);
}

/** Reads one package manifest without throwing for absent or malformed input. */
export function readJavaScriptPackageManifest(
  packagePath: string
): JavaScriptPackageManifest | undefined {
  try {
    const parsed = JSON.parse(fs.readFileSync(packagePath, 'utf8')) as unknown;
    return isRecord(parsed) ? (parsed as JavaScriptPackageManifest) : undefined;
  } catch {
    return undefined;
  }
}

/** Checks every dependency field used for Vue project ownership. */
export function declaresJavaScriptDependency(
  manifest: JavaScriptPackageManifest,
  packageName: string
): boolean {
  return DEPENDENCY_FIELDS.some(
    (field) => manifest[field]?.[packageName] !== undefined
  );
}

/** Lists dependency names across every supported manifest field. */
export function readDeclaredDependencyNames(
  manifest: JavaScriptPackageManifest
): string[] {
  const names = new Set<string>();
  for (const field of DEPENDENCY_FIELDS) {
    for (const packageName of Object.keys(manifest[field] ?? {})) {
      names.add(packageName);
    }
  }
  return [...names];
}

function cacheWorkspacePackages(
  cache: WorkspaceDiscoveryCache,
  cacheKey: string,
  manifestWorkspaces: string,
  packages: DeclaredWorkspacePackage[]
): DeclaredWorkspacePackage[] {
  cache.set(cacheKey, { manifestWorkspaces, packages });
  return packages;
}

function getPackageJsonWorkspacePatterns(
  manifest: JavaScriptPackageManifest
): string[] {
  if (Array.isArray(manifest.workspaces)) {
    return manifest.workspaces.filter(
      (pattern): pattern is string => typeof pattern === 'string'
    );
  }
  if (
    manifest.workspaces &&
    typeof manifest.workspaces === 'object' &&
    Array.isArray(manifest.workspaces.packages)
  ) {
    return manifest.workspaces.packages.filter(
      (pattern): pattern is string => typeof pattern === 'string'
    );
  }
  return [];
}

function getPnpmWorkspacePatterns(cwd: string): string[] | undefined {
  const workspacePath = path.join(cwd, 'pnpm-workspace.yaml');
  if (!fs.existsSync(workspacePath)) return undefined;

  try {
    const parsed = parseYaml(fs.readFileSync(workspacePath, 'utf8')) as unknown;
    if (parsed == null) return [];
    if (!isRecord(parsed)) return [];
    if (parsed.packages == null) return [];
    if (!Array.isArray(parsed.packages)) return [];
    return parsed.packages.filter(
      (pattern): pattern is string => typeof pattern === 'string'
    );
  } catch {
    return [];
  }
}

function toManifestPattern(pattern: string): string | null {
  const trimmed = pattern.trim();
  const negated = trimmed.startsWith('!');
  const rawPattern = negated ? trimmed.slice(1) : trimmed;
  if (!rawPattern) return null;

  const normalized = path.posix.normalize(rawPattern.replaceAll('\\', '/'));
  if (
    path.posix.isAbsolute(normalized) ||
    path.win32.isAbsolute(normalized) ||
    /^[A-Za-z]:/.test(normalized) ||
    containsParentTraversal(normalized) ||
    normalized === '..' ||
    normalized.startsWith('../')
  ) {
    return null;
  }

  const withoutTrailingSlash = normalized.replace(/\/+$/, '');
  const manifestPattern = withoutTrailingSlash.endsWith('/package.json')
    ? withoutTrailingSlash
    : `${withoutTrailingSlash}/package.json`;
  return negated ? `!${manifestPattern}` : manifestPattern;
}

/** Rejects parent segments, including those hidden in glob alternatives. */
function containsParentTraversal(pattern: string): boolean {
  return /(^|[/{,(|])\.\.(?=$|[/},)|])/.test(pattern);
}

function readRealPath(filePath: string): string | undefined {
  try {
    return fs.realpathSync(filePath);
  } catch {
    return undefined;
  }
}

function isWithinRoot(root: string, candidate: string): boolean {
  const relativePath = path.relative(path.resolve(root), candidate);
  return (
    relativePath !== '' &&
    relativePath !== '..' &&
    !relativePath.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relativePath)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
