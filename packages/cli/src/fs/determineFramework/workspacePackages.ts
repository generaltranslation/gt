import fs from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';
import { parse as parseYaml } from 'yaml';

export type JavaScriptPackageManifest = {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  workspaces?: string[] | { packages?: string[] };
};

export type DeclaredWorkspacePackage = {
  /** Absolute directory containing the workspace package manifest. */
  directory: string;
  /** Parsed workspace package manifest. */
  manifest: JavaScriptPackageManifest;
};

/**
 * Reads package manifests selected by workspace patterns declared at the
 * current project root.
 *
 * Both npm/Yarn `workspaces` and `pnpm-workspace.yaml` are supported. No
 * recursive fallback is used: a package is inspected only when a declared
 * pattern selects its `package.json`. Patterns that escape the project root,
 * malformed manifests, missing matches, symlink targets, and `node_modules`
 * entries are ignored so dependency detection cannot wander outside the
 * declared workspace.
 *
 * @param cwd - Project root containing the root package manifest.
 * @param rootManifest - Parsed root `package.json`.
 * @returns Valid package manifests selected by declared workspace patterns.
 */
export function readDeclaredWorkspaceManifests(
  cwd: string,
  rootManifest: JavaScriptPackageManifest
): JavaScriptPackageManifest[] {
  return readDeclaredWorkspacePackages(cwd, rootManifest).map(
    ({ manifest }) => manifest
  );
}

/**
 * Reads declared workspace manifests together with their package directories.
 *
 * Source discovery needs the directory associated with each dependency
 * declaration; returning it from the same validated traversal keeps framework
 * detection and default globs in agreement.
 */
export function readDeclaredWorkspacePackages(
  cwd: string,
  rootManifest: JavaScriptPackageManifest
): DeclaredWorkspacePackage[] {
  const patterns = [
    ...getPackageJsonWorkspacePatterns(rootManifest),
    ...getPnpmWorkspacePatterns(cwd),
  ];
  const manifestPatterns = [...new Set(patterns.map(toManifestPattern))].filter(
    (pattern): pattern is string => pattern !== null
  );

  if (!manifestPatterns.some((pattern) => !pattern.startsWith('!'))) {
    return [];
  }

  const realRoot = readRealPath(cwd);
  if (!realRoot) return [];

  const rootPackagePath = path.resolve(cwd, 'package.json');
  const packagePaths = fg.sync(manifestPatterns, {
    absolute: true,
    cwd,
    followSymbolicLinks: false,
    ignore: ['**/node_modules/**'],
    onlyFiles: true,
    unique: true,
  });

  return packagePaths.flatMap((packagePath) => {
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

function getPnpmWorkspacePatterns(cwd: string): string[] {
  const workspacePath = path.join(cwd, 'pnpm-workspace.yaml');
  if (!fs.existsSync(workspacePath)) return [];

  try {
    const parsed = parseYaml(fs.readFileSync(workspacePath, 'utf8')) as unknown;
    if (!isRecord(parsed) || !Array.isArray(parsed.packages)) return [];
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

/** Rejects parent segments, including those hidden inside glob alternatives. */
function containsParentTraversal(pattern: string): boolean {
  return /(^|[/{,(|])\.\.(?=$|[/},)|])/.test(pattern);
}

function readRealPath(filepath: string): string | undefined {
  try {
    return fs.realpathSync(filepath);
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

/**
 * Reads one JavaScript package manifest without throwing for malformed input.
 *
 * @param packagePath - Absolute path to a package.json file.
 * @returns The parsed object, or undefined when the file is missing or invalid.
 */
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

/** Checks every dependency field used by CLI framework detection. */
export function declaresJavaScriptDependency(
  manifest: JavaScriptPackageManifest,
  packageName: string
): boolean {
  return [
    manifest.dependencies,
    manifest.devDependencies,
    manifest.optionalDependencies,
    manifest.peerDependencies,
  ].some((dependencies) => dependencies?.[packageName] !== undefined);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
