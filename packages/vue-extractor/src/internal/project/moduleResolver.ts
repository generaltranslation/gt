import fs from 'node:fs';
import path from 'node:path';
import enhancedResolve, { type FileSystem } from 'enhanced-resolve';
import { createMatchPath, loadConfig } from 'tsconfig-paths';
import {
  readJavaScriptPackageManifest,
  resolveInstalledJavaScriptPackage,
  type JavaScriptPackageManifest,
} from './manifest.js';

const { ResolverFactory } = enhancedResolve;

const SOURCE_EXTENSIONS = [
  '.mjs',
  '.js',
  '.mts',
  '.ts',
  '.jsx',
  '.tsx',
  '.json',
] as const;

const SOURCE_EXTENSION_ALIASES = {
  '.cjs': ['.cjs', '.cts'],
  '.js': ['.js', '.ts', '.tsx'],
  '.jsx': ['.jsx', '.tsx'],
  '.mjs': ['.mjs', '.mts'],
};

const VITE_MAIN_FIELDS = [
  'browser',
  'module',
  'jsnext:main',
  'jsnext',
  'main',
] as const;

const COMMONJS_SOURCE_EXTENSIONS = new Set(['.cjs', '.cts']);

// Keep this in step with Vite's entry-point heuristic. A package may publish
// a CommonJS browser build alongside an ESM `module` build; Vite deliberately
// selects the module build for an ESM importer in that case.
const ESM_SYNTAX =
  /(?:[\s;]|^)(?:import[\s\w*,{}]*from|import\s*["'*{]|export\b\s*(?:[*{]|default|class|type|function|const|var|let|async function)|import\.meta\b)/m;

/** Conditions used by the CLI when no project override is supplied. */
export const DEFAULT_RESOLUTION_CONDITIONS = [
  'module',
  'browser',
  'development|production',
] as const;

type ProjectModuleResolverOptions = {
  /** Package currently being inspected, for standards-compliant self imports. */
  selfPackage?: {
    directory: string;
    manifest: JavaScriptPackageManifest;
  };
  /** Explicit tsconfig.json or jsconfig.json used for every importer. */
  tsconfigPath?: string;
};

/** Creates a deterministic, source-first resolver scoped to one extraction. */
export function createProjectModuleResolver(
  conditionNames: readonly string[] = DEFAULT_RESOLUTION_CONDITIONS,
  options: ProjectModuleResolverOptions = {}
): (specifier: string, importer: string) => string | undefined {
  const cache = new Map<string, string | undefined>();
  const explicitTsConfig =
    options.tsconfigPath === undefined
      ? undefined
      : loadConfig(options.tsconfigPath);
  return (specifier, importer) => {
    const cacheKey = `${importer}::${specifier}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    const result = resolveProjectModule(
      specifier,
      importer,
      conditionNames,
      options,
      explicitTsConfig
    );
    cache.set(cacheKey, result);
    return result;
  };
}

/** Resolves local barrels, TypeScript paths, and package export maps. */
function resolveProjectModule(
  specifier: string,
  importer: string,
  conditionNames: readonly string[],
  options: ProjectModuleResolverOptions,
  explicitTsConfig: ReturnType<typeof loadConfig> | undefined
): string | undefined {
  const basedir = path.dirname(importer);
  const extensions = [...SOURCE_EXTENSIONS];
  const isRequire = COMMONJS_SOURCE_EXTENSIONS.has(
    path.extname(importer).toLowerCase()
  );
  const mainFields = resolveViteMainFields(
    specifier,
    basedir,
    isRequire,
    options
  );
  const resolvedConditions = resolveConditionsForImporter(
    conditionNames,
    isRequire
  );

  const tsConfigResult = explicitTsConfig ?? loadConfig(basedir);
  if (tsConfigResult.resultType === 'success') {
    const matchPath = createMatchPath(
      tsConfigResult.absoluteBaseUrl,
      tsConfigResult.paths,
      mainFields
    );
    const directMatch = resolveExistingPath(
      matchPath(specifier, undefined, undefined, extensions),
      extensions
    );
    if (directMatch) return directMatch;

    const baseMatch = matchPath(specifier);
    for (const extension of extensions) {
      const explicitMatch = resolveExistingPath(
        matchPath(`${specifier}${extension}`),
        extensions
      );
      if (explicitMatch) return explicitMatch;
      const baseWithExtension = resolveExistingPath(
        baseMatch ? `${baseMatch}${extension}` : undefined,
        extensions
      );
      if (baseWithExtension) return baseWithExtension;
    }
  }

  try {
    const resolver = ResolverFactory.createResolver({
      useSyncFileSystemCalls: true,
      fileSystem: fs as unknown as FileSystem,
      extensions,
      aliasFields: ['browser'],
      conditionNames: resolvedConditions,
      extensionAlias: SOURCE_EXTENSION_ALIASES,
      exportsFields: ['exports'],
      mainFields,
    });
    const result = resolver.resolveSync({}, basedir, specifier);
    if (typeof result === 'string') return result;
  } catch {
    // Resolution is intentionally final. Falling back to a resolver that
    // ignores `exports` would expose package-private modules that Vite rejects.
  }
  return resolvePackageExportSourceAlternative(
    specifier,
    basedir,
    resolvedConditions,
    options
  );
}

/** Adds the import kind and expands Vite's mode placeholder deterministically. */
function resolveConditionsForImporter(
  conditionNames: readonly string[],
  isRequire: boolean
): string[] {
  const useProduction =
    conditionNames.includes('production') &&
    !conditionNames.includes('development');
  const modeCondition = useProduction ? 'production' : 'development';
  const conditions = conditionNames
    .filter((condition) => condition !== 'import' && condition !== 'require')
    .map((condition) =>
      condition === 'development|production' ? modeCondition : condition
    );
  conditions.push(isRequire ? 'require' : 'import', 'default');
  return [...new Set(conditions)];
}

/** Mirrors Vite's browser-entry versus ESM-module compatibility heuristic. */
function resolveViteMainFields(
  specifier: string,
  basedir: string,
  isRequire: boolean,
  options: ProjectModuleResolverOptions
): string[] {
  if (isRequire) return [...VITE_MAIN_FIELDS];
  const packageData = readImportedPackageData(specifier, basedir, options);
  if (!packageData) return [...VITE_MAIN_FIELDS];
  const { directory, manifest } = packageData;
  const browserEntry =
    typeof manifest.browser === 'string'
      ? manifest.browser
      : isUnknownRecord(manifest.browser) &&
          typeof manifest.browser['.'] === 'string'
        ? manifest.browser['.']
        : undefined;
  if (
    !browserEntry ||
    typeof manifest.module !== 'string' ||
    manifest.module === browserEntry
  ) {
    return [...VITE_MAIN_FIELDS];
  }
  const browserEntryPath = path.resolve(directory, browserEntry);
  const resolvedBrowserEntry =
    resolveExistingPath(browserEntryPath, SOURCE_EXTENSIONS) ??
    resolveSourceOutputPath(browserEntryPath);
  if (!resolvedBrowserEntry) return [...VITE_MAIN_FIELDS];
  try {
    if (ESM_SYNTAX.test(fs.readFileSync(resolvedBrowserEntry, 'utf8'))) {
      return [...VITE_MAIN_FIELDS];
    }
  } catch {
    return [...VITE_MAIN_FIELDS];
  }
  return ['module', 'browser', 'jsnext:main', 'jsnext', 'main'];
}

type ImportedPackageData = {
  directory: string;
  manifest: Record<string, unknown>;
};

/** Reads the package selected by Node's nearest-node_modules precedence. */
function readImportedPackageData(
  specifier: string,
  basedir: string,
  options: ProjectModuleResolverOptions = {}
): ImportedPackageData | undefined {
  const packageName = readPackageName(specifier);
  if (!packageName) return undefined;
  const selfPackage = options.selfPackage;
  if (
    selfPackage?.manifest.name === packageName &&
    isWithinDirectory(selfPackage.directory, basedir)
  ) {
    return {
      directory: selfPackage.directory,
      manifest: selfPackage.manifest as Record<string, unknown>,
    };
  }
  const nearestPackage = readNearestPackageData(basedir);
  if (nearestPackage?.manifest.name === packageName) return nearestPackage;
  const installed = resolveInstalledJavaScriptPackage(basedir, packageName);
  return installed
    ? {
        directory: installed.directory,
        manifest: installed.manifest as Record<string, unknown>,
      }
    : undefined;
}

/** Reads only the importer's nearest package scope for self-reference lookup. */
function readNearestPackageData(
  basedir: string
): ImportedPackageData | undefined {
  let current = path.resolve(basedir);
  while (true) {
    const manifestPath = path.join(current, 'package.json');
    if (fs.existsSync(manifestPath)) {
      const manifest = readJavaScriptPackageManifest(manifestPath);
      return manifest
        ? { directory: current, manifest: manifest as Record<string, unknown> }
        : undefined;
    }
    const parent = path.dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

/**
 * Recovers TypeScript source behind a JavaScript package export target.
 *
 * This fallback interprets the package's export map instead of probing its
 * filesystem by subpath. That distinction preserves package encapsulation:
 * an unexported file remains unresolved even when it physically exists.
 */
function resolvePackageExportSourceAlternative(
  specifier: string,
  basedir: string,
  conditions: readonly string[],
  options: ProjectModuleResolverOptions
): string | undefined {
  const packageName = readPackageName(specifier);
  const packageData = readImportedPackageData(specifier, basedir, options);
  if (
    !packageName ||
    !packageData ||
    packageData.manifest.exports === undefined
  ) {
    return undefined;
  }
  const subpath =
    specifier === packageName ? '.' : `.${specifier.slice(packageName.length)}`;
  const target = resolveExportsTarget(
    packageData.manifest.exports,
    subpath,
    new Set(conditions)
  );
  if (!target || !target.startsWith('./')) return undefined;
  const mappedTarget = applyPackageBrowserMap(target, packageData.manifest);
  if (!mappedTarget || !mappedTarget.startsWith('./')) return undefined;
  const candidate = path.resolve(packageData.directory, mappedTarget);
  const relative = path.relative(packageData.directory, candidate);
  if (
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    return undefined;
  }
  return resolveSourceOutputPath(candidate);
}

function isWithinDirectory(directory: string, candidate: string): boolean {
  const relative = path.relative(
    path.resolve(directory),
    path.resolve(candidate)
  );
  return (
    relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

/** Resolves the exact or best-pattern subpath before evaluating conditions. */
function resolveExportsTarget(
  exportsField: unknown,
  subpath: string,
  conditions: ReadonlySet<string>
): string | undefined {
  if (!isUnknownRecord(exportsField) || isConditionalExports(exportsField)) {
    return subpath === '.'
      ? resolveConditionalTarget(exportsField, conditions)
      : undefined;
  }
  if (Object.prototype.hasOwnProperty.call(exportsField, subpath)) {
    return resolveConditionalTarget(exportsField[subpath], conditions);
  }
  const pattern = Object.keys(exportsField)
    .filter((key) => key.startsWith('./') && key.includes('*'))
    .map((key) => {
      const star = key.indexOf('*');
      const prefix = key.slice(0, star);
      const suffix = key.slice(star + 1);
      return subpath.startsWith(prefix) && subpath.endsWith(suffix)
        ? {
            key,
            match: subpath.slice(prefix.length, subpath.length - suffix.length),
            prefixLength: prefix.length,
            suffixLength: suffix.length,
          }
        : undefined;
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== undefined)
    .sort(
      (left, right) =>
        right.prefixLength - left.prefixLength ||
        right.suffixLength - left.suffixLength ||
        right.key.length - left.key.length
    )[0];
  if (!pattern) return undefined;
  const target = resolveConditionalTarget(
    exportsField[pattern.key],
    conditions
  );
  return target?.replaceAll('*', pattern.match);
}

/** Evaluates export conditions in declaration order, matching Node and Vite. */
function resolveConditionalTarget(
  target: unknown,
  conditions: ReadonlySet<string>
): string | undefined {
  if (typeof target === 'string') return target;
  if (Array.isArray(target)) {
    for (const candidate of target) {
      const resolved = resolveConditionalTarget(candidate, conditions);
      if (resolved) return resolved;
    }
    return undefined;
  }
  if (!isUnknownRecord(target)) return undefined;
  for (const [condition, candidate] of Object.entries(target)) {
    if (condition !== 'default' && !conditions.has(condition)) continue;
    const resolved = resolveConditionalTarget(candidate, conditions);
    if (resolved) return resolved;
  }
  return undefined;
}

function isConditionalExports(exportsField: Record<string, unknown>): boolean {
  return Object.keys(exportsField).every((key) => !key.startsWith('.'));
}

/** Applies the object form of a package browser map to an export target. */
function applyPackageBrowserMap(
  target: string,
  manifest: Record<string, unknown>
): string | undefined {
  if (!isUnknownRecord(manifest.browser)) return target;
  const normalizedTarget = path.posix.normalize(target);
  for (const [key, mapped] of Object.entries(manifest.browser)) {
    const normalizedKey = path.posix.normalize(key);
    if (
      normalizedTarget !== normalizedKey &&
      !equalWithoutSuffix(normalizedTarget, normalizedKey, '.js') &&
      !equalWithoutSuffix(normalizedTarget, normalizedKey, '/index.js')
    ) {
      continue;
    }
    return typeof mapped === 'string' ? mapped : undefined;
  }
  return target;
}

function equalWithoutSuffix(
  target: string,
  key: string,
  suffix: string
): boolean {
  return key.endsWith(suffix) && key.slice(0, -suffix.length) === target;
}

/** Maps emitted JS-family file names to their source equivalents like Vite. */
function resolveSourceOutputPath(candidate: string): string | undefined {
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    return candidate;
  }
  const extension = path.extname(candidate).toLowerCase();
  const alternatives =
    SOURCE_EXTENSION_ALIASES[
      extension as keyof typeof SOURCE_EXTENSION_ALIASES
    ];
  if (!alternatives) return undefined;
  const stem = candidate.slice(0, -extension.length);
  for (const alternative of alternatives.slice(1)) {
    const source = `${stem}${alternative}`;
    try {
      if (fs.statSync(source).isFile()) return source;
    } catch {
      // Try the next source extension.
    }
  }
  return undefined;
}

function readPackageName(specifier: string): string | undefined {
  if (
    !specifier ||
    specifier.startsWith('.') ||
    specifier.startsWith('/') ||
    specifier.startsWith('#')
  ) {
    return undefined;
  }
  const segments = specifier.split('/');
  if (specifier.startsWith('@')) {
    return segments.length >= 2 ? `${segments[0]}/${segments[1]}` : undefined;
  }
  return segments[0];
}

function isUnknownRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function resolveExistingPath(
  filePath: string | undefined,
  extensions: readonly string[]
): string | undefined {
  if (!filePath) return undefined;
  try {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      if (stats.isFile()) return filePath;
      if (stats.isDirectory()) {
        for (const extension of extensions) {
          const indexPath = path.join(filePath, `index${extension}`);
          if (fs.existsSync(indexPath) && fs.statSync(indexPath).isFile()) {
            return indexPath;
          }
        }
      }
    }
    for (const extension of extensions) {
      const candidate = `${filePath}${extension}`;
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
}
