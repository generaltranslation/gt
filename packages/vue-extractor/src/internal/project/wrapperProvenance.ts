import fs from 'node:fs';
import path from 'node:path';
import { createLocalModuleResolver } from '../script/localModules.js';
import type { JavaScriptPackageManifest } from './manifest.js';
import { createProjectModuleResolver } from './moduleResolver.js';

const SOURCE_EXTENSIONS = [
  '.mjs',
  '.js',
  '.mts',
  '.ts',
  '.jsx',
  '.tsx',
] as const;

/** Prevents a pathological export pattern from turning detection into a crawl. */
const MAX_PATTERN_FILES = 2_000;

/** Conditions used by the package's default ESM/Vite resolver. */
const IMPORT_CONDITIONS = new Set([
  'module',
  'browser',
  'development',
  'import',
  'default',
]);

type PublicPackageManifest = JavaScriptPackageManifest & {
  browser?: string | { '.'?: string };
  exports?: unknown;
  'jsnext:main'?: string;
  jsnext?: string;
  main?: string;
  module?: string;
};

export type PublicImportEntry = {
  entry: string;
  specifier: string;
};

export type PublicGTImport = PublicImportEntry & {
  exportNames: ReadonlySet<string>;
};

/**
 * Returns whether a local package publicly exposes a gt-vue-derived value.
 *
 * Merely using gt-vue inside a package does not make every consumer a Vue
 * application. This check starts at public import entrypoints and follows the
 * same local ESM provenance graph as source extraction, so only an API that a
 * consumer can actually import propagates Vue ownership.
 */
export function packagePubliclyExposesGT(
  packageDirectory: string,
  manifest: JavaScriptPackageManifest
): boolean {
  return readPublicGTImports(packageDirectory, manifest).length > 0;
}

/** Resolves every public import entry and retains its GT-derived export names. */
export function readPublicGTImports(
  packageDirectory: string,
  manifest: JavaScriptPackageManifest
): PublicGTImport[] {
  const resolveModule = createProjectModuleResolver(undefined, {
    selfPackage: { directory: packageDirectory, manifest },
  });
  const entries = resolvePublicImportEntries(
    packageDirectory,
    manifest,
    resolveModule
  );
  if (entries.length === 0) return [];

  const localModules = createLocalModuleResolver(resolveModule, {
    recognizeAllGTRuntimeExports: true,
  });
  return entries.flatMap(({ entry, specifier }) => {
    // Invalid entrypoints fail closed. The source analyzer can recover enough
    // provenance from malformed modules to emit diagnostics, but malformed
    // package code must not establish project ownership by itself.
    if (!localModules.getRecord(entry)) return [];
    const exportNames = localModules
      .listExportNames(entry)
      .filter(
        (name) => localModules.getGTExportName(entry, name) !== undefined
      );
    return exportNames.length > 0
      ? [{ entry, exportNames: new Set(exportNames), specifier }]
      : [];
  });
}

/** Resolves a package's public ESM import entries without executing code. */
export function readPublicImportEntries(
  packageDirectory: string,
  manifest: JavaScriptPackageManifest
): PublicImportEntry[] {
  return resolvePublicImportEntries(
    packageDirectory,
    manifest,
    createProjectModuleResolver(undefined, {
      selfPackage: { directory: packageDirectory, manifest },
    })
  );
}

/** Resolves root and exact-subpath import entrypoints without executing code. */
function resolvePublicImportEntries(
  packageDirectory: string,
  manifest: JavaScriptPackageManifest,
  resolveModule: ReturnType<typeof createProjectModuleResolver>
): PublicImportEntry[] {
  const publicManifest = manifest as PublicPackageManifest;
  const packageName = readPackageName(manifest);
  const importer = path.join(packageDirectory, '__gt_vue_entry_probe__.mjs');
  const entries = new Map<string, PublicImportEntry>();

  if (packageName && publicManifest.exports !== undefined) {
    for (const specifier of readExactPublicSpecifiers(
      packageName,
      publicManifest.exports
    )) {
      const entry = resolveModule(specifier, importer);
      if (entry && isWithinPackage(packageDirectory, entry)) {
        entries.set(specifier, { entry: resolveRealPath(entry), specifier });
      }
    }
    for (const entry of resolveWildcardPublicEntries(
      packageDirectory,
      packageName,
      publicManifest.exports,
      importer,
      resolveModule
    )) {
      entries.set(entry.specifier, entry);
    }
    // An exports map encapsulates the package. Never fall back to private main
    // fields when none of its public import conditions can be resolved.
    return [...entries.values()];
  }

  const browserEntry =
    typeof publicManifest.browser === 'string'
      ? publicManifest.browser
      : typeof publicManifest.browser === 'object' &&
          publicManifest.browser !== null &&
          typeof publicManifest.browser['.'] === 'string'
        ? publicManifest.browser['.']
        : undefined;
  for (const candidate of [
    browserEntry,
    publicManifest.module,
    publicManifest['jsnext:main'],
    publicManifest.jsnext,
    publicManifest.main,
    'index',
  ]) {
    if (typeof candidate !== 'string') continue;
    const entry = resolveSourceEntry(packageDirectory, candidate);
    if (entry) {
      if (packageName) {
        entries.set(packageName, { entry, specifier: packageName });
      }
      // Match package entry selection: the first resolvable main field wins.
      break;
    }
  }
  return [...entries.values()];
}

/**
 * Expands finite package-export patterns and verifies each generated subpath.
 *
 * The project resolver remains authoritative for conditions and export-key
 * precedence. Files discovered from inactive `require` or `types` branches,
 * shadowed patterns, and targets outside the package therefore cannot prove
 * public runtime provenance.
 */
function resolveWildcardPublicEntries(
  packageDirectory: string,
  packageName: string,
  exportsField: unknown,
  importer: string,
  resolveModule: ReturnType<typeof createProjectModuleResolver>
): PublicImportEntry[] {
  if (!isRecord(exportsField) || isConditionalExports(exportsField)) return [];
  const entries = new Map<string, PublicImportEntry>();
  const fileBudget = { remaining: MAX_PATTERN_FILES };
  for (const [subpath, target] of Object.entries(exportsField)) {
    if (!subpath.startsWith('./') || !subpath.includes('*')) continue;
    for (const targetPattern of collectImportTargets(target)) {
      const candidates = expandTargetPattern(
        packageDirectory,
        targetPattern,
        fileBudget
      );
      for (const { capture, file } of candidates) {
        const publicSubpath = subpath.replaceAll('*', capture);
        if (!isSafePublicSubpath(publicSubpath)) continue;
        const resolved = resolveModule(
          `${packageName}${publicSubpath.slice(1)}`,
          importer
        );
        if (
          !resolved ||
          !isWithinPackage(packageDirectory, resolved) ||
          resolveRealPath(resolved) !== resolveRealPath(file)
        ) {
          continue;
        }
        const specifier = `${packageName}${publicSubpath.slice(1)}`;
        entries.set(specifier, {
          entry: resolveRealPath(resolved),
          specifier,
        });
      }
    }
  }
  return [...entries.values()];
}

/** Selects conditional targets using the same default ESM conditions. */
function collectImportTargets(target: unknown): string[] {
  if (typeof target === 'string') return [target];
  if (Array.isArray(target)) return target.flatMap(collectImportTargets);
  if (!isRecord(target)) return [];
  for (const [condition, conditionalTarget] of Object.entries(target)) {
    if (!IMPORT_CONDITIONS.has(condition)) continue;
    const targets = collectImportTargets(conditionalTarget);
    if (targets.length > 0) return targets;
  }
  return [];
}

type ExpandedTarget = { capture: string; file: string };

/** Expands one target pattern beneath its longest literal directory prefix. */
function expandTargetPattern(
  packageDirectory: string,
  targetPattern: string,
  fileBudget: { remaining: number }
): ExpandedTarget[] {
  if (!targetPattern.startsWith('./')) return [];
  const patterns = readSourceTargetPatterns(targetPattern);
  const expanded = new Map<string, ExpandedTarget>();
  for (const pattern of patterns) {
    if (!pattern.includes('*')) {
      const file = resolveSourceEntry(packageDirectory, pattern);
      if (file && isWithinPackage(packageDirectory, file)) {
        expanded.set(`\0${file}`, { capture: '__gt_vue_probe__', file });
      }
      continue;
    }

    const searchDirectory = resolvePatternSearchDirectory(
      packageDirectory,
      pattern
    );
    if (!searchDirectory) continue;
    const files = readFiniteFiles(searchDirectory, fileBudget);
    if (!files) continue;
    for (const file of files) {
      if (!isWithinPackage(packageDirectory, file)) continue;
      const packageRelative = `./${toPosixPath(
        path.relative(packageDirectory, file)
      )}`;
      const capture = matchPatternCapture(pattern, packageRelative);
      if (capture === undefined || !isSafePatternCapture(capture)) continue;
      expanded.set(`${capture}\0${file}`, { capture, file });
    }
  }
  return [...expanded.values()];
}

/** Includes source equivalents for export maps that name emitted JS files. */
function readSourceTargetPatterns(targetPattern: string): string[] {
  const extension = path.posix.extname(targetPattern).toLowerCase();
  const stem = targetPattern.slice(0, -extension.length);
  if (extension === '.js') {
    return [targetPattern, `${stem}.ts`, `${stem}.tsx`];
  }
  if (extension === '.jsx') return [targetPattern, `${stem}.tsx`];
  if (extension === '.mjs') return [targetPattern, `${stem}.mts`];
  return [targetPattern];
}

function resolvePatternSearchDirectory(
  packageDirectory: string,
  targetPattern: string
): string | undefined {
  const literalPrefix = targetPattern.slice(2, targetPattern.indexOf('*'));
  const directoryPrefix = literalPrefix.endsWith('/')
    ? literalPrefix
    : literalPrefix.slice(0, literalPrefix.lastIndexOf('/') + 1);
  const candidate = path.resolve(packageDirectory, directoryPrefix);
  if (!isWithinPackage(packageDirectory, candidate)) return undefined;
  try {
    return fs.statSync(candidate).isDirectory() ? candidate : undefined;
  } catch {
    return undefined;
  }
}

/** Reads regular files without following symlinked directories or node_modules. */
function readFiniteFiles(
  directory: string,
  fileBudget: { remaining: number }
): string[] | undefined {
  const files: string[] = [];
  const pending = [directory];
  while (pending.length > 0) {
    const current = pending.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return undefined;
    }
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      const candidate = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(candidate);
      } else if (entry.isFile()) {
        files.push(candidate);
        fileBudget.remaining -= 1;
        if (fileBudget.remaining < 0) return undefined;
      }
    }
  }
  return files;
}

/** Returns the wildcard capture when a package-relative target matches. */
function matchPatternCapture(
  targetPattern: string,
  candidate: string
): string | undefined {
  const parts = targetPattern.split('*');
  if (parts.length < 2) return targetPattern === candidate ? '' : undefined;
  const expression = new RegExp(
    `^${escapeRegularExpression(parts[0]!)}(.*)${parts
      .slice(1)
      .map(
        (part, index) =>
          `${index === 0 ? '' : '\\1'}${escapeRegularExpression(part)}`
      )
      .join('')}$`
  );
  return expression.exec(candidate)?.[1];
}

function isSafePatternCapture(capture: string): boolean {
  return (
    capture.length > 0 &&
    !capture.includes('\\') &&
    !capture.split('/').some((segment) => segment === '..')
  );
}

function isSafePublicSubpath(subpath: string): boolean {
  return (
    subpath.startsWith('./') &&
    !subpath.includes('\\') &&
    !subpath.split('/').some((segment) => segment === '..')
  );
}

function escapeRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join(path.posix.sep);
}

/** Lists the package root and exact subpaths that an import may request. */
function readExactPublicSpecifiers(
  packageName: string,
  exportsField: unknown
): string[] {
  if (!isRecord(exportsField) || isConditionalExports(exportsField)) {
    return [packageName];
  }
  return Object.keys(exportsField)
    .filter(
      (subpath) =>
        (subpath === '.' || subpath.startsWith('./')) && !subpath.includes('*')
    )
    .map((subpath) =>
      subpath === '.' ? packageName : `${packageName}${subpath.slice(1)}`
    );
}

function isConditionalExports(exportsField: Record<string, unknown>): boolean {
  return Object.keys(exportsField).every((key) => !key.startsWith('.'));
}

/** Resolves a legacy package entry while preferring emitted files when present. */
function resolveSourceEntry(
  packageDirectory: string,
  requestedEntry: string
): string | undefined {
  const requested = path.resolve(packageDirectory, requestedEntry);
  const relative = path.relative(packageDirectory, requested);
  if (
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    return undefined;
  }

  const candidates = [requested];
  const extension = path.extname(requested).toLowerCase();
  if (!extension) {
    for (const sourceExtension of SOURCE_EXTENSIONS) {
      candidates.push(`${requested}${sourceExtension}`);
    }
    for (const sourceExtension of SOURCE_EXTENSIONS) {
      candidates.push(path.join(requested, `index${sourceExtension}`));
    }
  } else if (extension === '.js' || extension === '.jsx') {
    const stem = requested.slice(0, -extension.length);
    for (const sourceExtension of SOURCE_EXTENSIONS) {
      candidates.push(`${stem}${sourceExtension}`);
    }
  }
  for (const candidate of candidates) {
    try {
      if (fs.statSync(candidate).isFile()) return resolveRealPath(candidate);
    } catch {
      // Try the next public source candidate.
    }
  }
  return undefined;
}

function isWithinPackage(packageDirectory: string, file: string): boolean {
  const root = resolveRealPath(packageDirectory);
  const candidate = resolveRealPath(file);
  const relative = path.relative(root, candidate);
  return (
    relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

function resolveRealPath(file: string): string {
  try {
    return fs.realpathSync(file);
  } catch {
    return path.resolve(file);
  }
}

function readPackageName(
  manifest: JavaScriptPackageManifest
): string | undefined {
  return typeof manifest.name === 'string' && manifest.name
    ? manifest.name
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
