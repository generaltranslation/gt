import fs from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';
import { parse as parseYaml } from 'yaml';
import {
  readJavaScriptPackageManifest,
  type JavaScriptPackageManifest,
} from './manifest.js';

const ASYNC_WORKSPACE_READ_CONCURRENCY = 64;

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
  packagePaths.sort(comparePaths);

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

/**
 * Reads declared workspace packages without blocking on every manifest.
 *
 * The returned packages and cache entry are identical to the synchronous
 * implementation. Project inspection can populate this cache concurrently
 * with a host framework's existing extraction, then reuse the established
 * synchronous ownership logic without traversing the workspace twice.
 */
export async function readDeclaredWorkspacePackagesAsync(
  cwd: string,
  rootManifest: JavaScriptPackageManifest,
  cache: WorkspaceDiscoveryCache
): Promise<DeclaredWorkspacePackage[]> {
  const cacheKey = path.resolve(cwd);
  const manifestWorkspaces = JSON.stringify(rootManifest.workspaces ?? null);
  const cached = cache.get(cacheKey);
  if (cached?.manifestWorkspaces === manifestWorkspaces) {
    return cached.packages;
  }

  const pnpmPatterns = await getPnpmWorkspacePatternsAsync(cwd);
  const patterns =
    pnpmPatterns ?? getPackageJsonWorkspacePatterns(rootManifest);
  const manifestPatterns = [...new Set(patterns.map(toManifestPattern))].filter(
    (pattern): pattern is string => pattern !== null
  );
  if (!manifestPatterns.some((pattern) => !pattern.startsWith('!'))) {
    return cacheWorkspacePackages(cache, cacheKey, manifestWorkspaces, []);
  }

  const realRoot = await readRealPathAsync(cwd);
  if (!realRoot) {
    return cacheWorkspacePackages(cache, cacheKey, manifestWorkspaces, []);
  }

  let packagePaths: string[];
  try {
    packagePaths = await fg(manifestPatterns, {
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
  packagePaths.sort(comparePaths);

  const rootPackagePath = path.resolve(cwd, 'package.json');
  const packageResults = await mapWithConcurrency(
    packagePaths,
    ASYNC_WORKSPACE_READ_CONCURRENCY,
    async (packagePath) => {
      const absolutePath = path.resolve(packagePath);
      if (
        absolutePath === rootPackagePath ||
        !isWithinRoot(cwd, absolutePath) ||
        absolutePath.split(path.sep).includes('node_modules')
      ) {
        return undefined;
      }

      const realPackagePath = await readRealPathAsync(absolutePath);
      if (
        !realPackagePath ||
        !isWithinRoot(realRoot, realPackagePath) ||
        realPackagePath.split(path.sep).includes('node_modules')
      ) {
        return undefined;
      }
      const manifest =
        await readJavaScriptPackageManifestAsync(realPackagePath);
      return manifest
        ? { directory: path.dirname(absolutePath), manifest }
        : undefined;
    }
  );
  const packages = packageResults.filter(
    (workspacePackage): workspacePackage is DeclaredWorkspacePackage =>
      workspacePackage !== undefined
  );
  return cacheWorkspacePackages(cache, cacheKey, manifestWorkspaces, packages);
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

async function getPnpmWorkspacePatternsAsync(
  cwd: string
): Promise<string[] | undefined> {
  const workspacePath = path.join(cwd, 'pnpm-workspace.yaml');
  if (!fs.existsSync(workspacePath)) return undefined;

  try {
    const parsed = parseYaml(
      await fs.promises.readFile(workspacePath, 'utf8')
    ) as unknown;
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

async function readRealPathAsync(
  filePath: string
): Promise<string | undefined> {
  try {
    return await fs.promises.realpath(filePath);
  } catch {
    return undefined;
  }
}

async function readJavaScriptPackageManifestAsync(
  packagePath: string
): Promise<JavaScriptPackageManifest | undefined> {
  try {
    const parsed = JSON.parse(
      await fs.promises.readFile(packagePath, 'utf8')
    ) as unknown;
    return isRecord(parsed) ? (parsed as JavaScriptPackageManifest) : undefined;
  } catch {
    return undefined;
  }
}

/** Maps filesystem work concurrently without exhausting file descriptors. */
async function mapWithConcurrency<Input, Output>(
  values: readonly Input[],
  concurrency: number,
  mapper: (value: Input) => Promise<Output>
): Promise<Output[]> {
  const results = Array.from({ length: values.length }) as Output[];
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(values[index]!);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, () => worker())
  );
  return results;
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

function comparePaths(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
