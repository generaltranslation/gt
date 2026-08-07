import fs from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';
import { parse as parseYaml } from 'yaml';
import type { JavaScriptPackageManifest } from './manifest.js';

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

  const shallowPackagePaths = readShallowWorkspaceManifestPaths(
    cwd,
    realRoot,
    manifestPatterns
  );
  const packagePaths =
    shallowPackagePaths ??
    readWorkspaceManifestPathsWithGlob(cwd, manifestPatterns);
  if (!packagePaths) {
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

    const manifestPath = shallowPackagePaths
      ? absolutePath
      : readValidatedManifestPath(realRoot, absolutePath);
    if (!manifestPath) return [];
    const manifest = readWorkspacePackageManifest(manifestPath);
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

  const shallowPackagePaths = await readShallowWorkspaceManifestPathsAsync(
    cwd,
    realRoot,
    manifestPatterns
  );
  let packagePaths: string[] | undefined;
  if (shallowPackagePaths) {
    packagePaths = shallowPackagePaths;
  } else {
    try {
      packagePaths = await fg([...manifestPatterns], workspaceGlobOptions(cwd));
    } catch {
      packagePaths = undefined;
    }
  }
  if (!packagePaths) {
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

      const manifestPath = shallowPackagePaths
        ? absolutePath
        : await readValidatedManifestPathAsync(realRoot, absolutePath);
      if (!manifestPath) return undefined;
      const manifest = await readJavaScriptPackageManifestAsync(manifestPath);
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

/**
 * Finds workspace manifests, optimizing only the common shallow-positive form.
 *
 * A pattern such as `packages/<child>/package.json` can be resolved with one
 * directory read instead of traversing every child directory. All negative,
 * nested, or otherwise dynamic patterns keep fast-glob's existing behavior.
 */
function readShallowWorkspaceManifestPaths(
  cwd: string,
  realRoot: string,
  manifestPatterns: readonly string[]
): string[] | undefined {
  const shallowBases = readShallowPositiveBases(manifestPatterns);
  if (!shallowBases) return undefined;

  try {
    const paths = shallowBases.flatMap((base) => {
      const baseDirectory = path.resolve(cwd, base);
      if (!isSafeShallowBase(realRoot, readRealPath(baseDirectory))) return [];
      try {
        return fs
          .readdirSync(baseDirectory, { withFileTypes: true })
          .filter(isVisibleDirectoryEntry)
          .map((entry) => path.join(baseDirectory, entry.name, 'package.json'));
      } catch {
        return [];
      }
    });
    return [...new Set(paths)];
  } catch {
    return undefined;
  }
}

/** Asynchronous counterpart to {@link readShallowWorkspaceManifestPaths}. */
async function readShallowWorkspaceManifestPathsAsync(
  cwd: string,
  realRoot: string,
  manifestPatterns: readonly string[]
): Promise<string[] | undefined> {
  const shallowBases = readShallowPositiveBases(manifestPatterns);
  if (!shallowBases) return undefined;

  try {
    const entriesByBase = await Promise.all(
      shallowBases.map(async (base) => {
        const baseDirectory = path.resolve(cwd, base);
        const realBase = await readRealPathAsync(baseDirectory);
        if (!isSafeShallowBase(realRoot, realBase)) {
          return { baseDirectory, entries: [] };
        }
        try {
          return {
            baseDirectory,
            entries: await fs.promises.readdir(baseDirectory, {
              withFileTypes: true,
            }),
          };
        } catch {
          return { baseDirectory, entries: [] };
        }
      })
    );
    const paths = entriesByBase.flatMap(({ baseDirectory, entries }) =>
      entries
        .filter(isVisibleDirectoryEntry)
        .map((entry) => path.join(baseDirectory, entry.name, 'package.json'))
    );
    return [...new Set(paths)];
  } catch {
    return undefined;
  }
}

/** Uses fast-glob for workspace layouts outside the bounded shallow form. */
function readWorkspaceManifestPathsWithGlob(
  cwd: string,
  manifestPatterns: readonly string[]
): string[] | undefined {
  try {
    return fg.sync([...manifestPatterns], workspaceGlobOptions(cwd));
  } catch {
    return undefined;
  }
}

/** Shared options preserve the historical fast-glob matching semantics. */
function workspaceGlobOptions(
  cwd: string
): NonNullable<Parameters<typeof fg.sync>[1]> {
  return {
    absolute: true,
    cwd,
    followSymbolicLinks: false,
    ignore: ['**/node_modules/**'],
    onlyFiles: true,
    unique: true,
  };
}

/**
 * Reads literal bases from patterns shaped like `<base>/<child>/package.json`.
 * Hidden child directories are intentionally excluded to match fast-glob's
 * default `dot: false` behavior.
 */
function readShallowPositiveBases(
  manifestPatterns: readonly string[]
): string[] | undefined {
  const bases: string[] = [];
  for (const pattern of manifestPatterns) {
    if (pattern.startsWith('!')) return undefined;
    const segments = pattern.split('/');
    if (
      segments.length < 2 ||
      segments.at(-1) !== 'package.json' ||
      segments.at(-2) !== '*'
    ) {
      return undefined;
    }
    const base = segments.slice(0, -2).join('/') || '.';
    if (fg.isDynamicPattern(base)) return undefined;
    bases.push(base);
  }
  return [...new Set(bases)];
}

/** Matches only visible physical directories, excluding symlinked workspaces. */
function isVisibleDirectoryEntry(entry: fs.Dirent): boolean {
  return !entry.name.startsWith('.') && entry.isDirectory();
}

/** Validates one physical shallow base before skipping per-manifest realpath. */
function isSafeShallowBase(
  realRoot: string,
  realBase: string | undefined
): boolean {
  if (!realBase || !isWithinOrEqualRoot(realRoot, realBase)) return false;
  const relative = path.relative(realRoot, realBase);
  return !relative.split(path.sep).includes('node_modules');
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

/** Preserves the historical physical containment check for glob fallbacks. */
function readValidatedManifestPath(
  realRoot: string,
  packagePath: string
): string | undefined {
  const realPackagePath = readRealPath(packagePath);
  return realPackagePath &&
    isWithinRoot(realRoot, realPackagePath) &&
    !realPackagePath.split(path.sep).includes('node_modules')
    ? realPackagePath
    : undefined;
}

/** Asynchronous counterpart to {@link readValidatedManifestPath}. */
async function readValidatedManifestPathAsync(
  realRoot: string,
  packagePath: string
): Promise<string | undefined> {
  const realPackagePath = await readRealPathAsync(packagePath);
  return realPackagePath &&
    isWithinRoot(realRoot, realPackagePath) &&
    !realPackagePath.split(path.sep).includes('node_modules')
    ? realPackagePath
    : undefined;
}

async function readJavaScriptPackageManifestAsync(
  packagePath: string
): Promise<JavaScriptPackageManifest | undefined> {
  let file: fs.promises.FileHandle | undefined;
  try {
    const stats = await fs.promises.lstat(packagePath);
    if (!stats.isFile()) return undefined;
    file = await fs.promises.open(packagePath, workspaceManifestOpenFlags());
    const parsed = JSON.parse(await file.readFile('utf8')) as unknown;
    return isRecord(parsed) ? (parsed as JavaScriptPackageManifest) : undefined;
  } catch {
    return undefined;
  } finally {
    await file?.close();
  }
}

/** Reads a workspace manifest without following a manifest-file symlink. */
function readWorkspacePackageManifest(
  packagePath: string
): JavaScriptPackageManifest | undefined {
  let descriptor: number | undefined;
  try {
    if (!fs.lstatSync(packagePath).isFile()) return undefined;
    descriptor = fs.openSync(packagePath, workspaceManifestOpenFlags());
    const parsed = JSON.parse(fs.readFileSync(descriptor, 'utf8')) as unknown;
    return isRecord(parsed) ? (parsed as JavaScriptPackageManifest) : undefined;
  } catch {
    return undefined;
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

/** Prevents a shallow workspace candidate from redirecting its manifest. */
function workspaceManifestOpenFlags(): number {
  return fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0);
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

/** Checks physical containment while allowing the project root itself. */
function isWithinOrEqualRoot(root: string, candidate: string): boolean {
  return (
    path.resolve(root) === path.resolve(candidate) ||
    isWithinRoot(root, candidate)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function comparePaths(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
