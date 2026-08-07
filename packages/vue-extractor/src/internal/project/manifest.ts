import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import {
  satisfies as satisfiesSemver,
  valid as validSemver,
  validRange as validSemverRange,
} from 'semver';

/** Runtime package whose direct ownership activates Vue extraction. */
export const GT_VUE_PACKAGE = 'gt-vue';

/** Dependency fields that declare a runtime installed for one package. */
const INSTALLED_DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
] as const;

/** Minimal package manifest shape used by Vue project discovery. */
export type JavaScriptPackageManifest = {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
  workspaces?: string[] | { packages?: string[] };
};

/** One dependency name and specifier as written by a consuming package. */
export type JavaScriptDependencyBinding = {
  name: string;
  specifier: string;
};

/** An installed package directory resolved without evaluating its entrypoint. */
export type InstalledJavaScriptPackage = {
  directory: string;
  manifest: JavaScriptPackageManifest;
};

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

/** Checks dependency fields that make a runtime available to package code. */
export function declaresInstalledJavaScriptDependency(
  manifest: JavaScriptPackageManifest,
  packageName: string
): boolean {
  return INSTALLED_DEPENDENCY_FIELDS.some(
    (field) => manifest[field]?.[packageName] !== undefined
  );
}

/** Checks direct ownership, requiring optional and peer runtimes to resolve. */
export function declaresAvailableJavaScriptDependency(
  manifest: JavaScriptPackageManifest,
  packageName: string,
  packageDirectory: string
): boolean {
  if (declaresInstalledJavaScriptDependency(manifest, packageName)) return true;
  if (manifest.optionalDependencies?.[packageName] !== undefined) {
    return canResolvePackage(packageDirectory, packageName);
  }
  return declaresAvailableRequiredPeerDependency(
    manifest,
    packageName,
    packageDirectory
  );
}

/** Checks package ownership without promoting optional workspace integrations. */
export function declaresWorkspaceJavaScriptDependency(
  manifest: JavaScriptPackageManifest,
  packageName: string,
  packageDirectory: string
): boolean {
  return (
    declaresInstalledJavaScriptDependency(manifest, packageName) ||
    declaresAvailableRequiredPeerDependency(
      manifest,
      packageName,
      packageDirectory
    )
  );
}

/** Checks dependencies that may propagate wrapper ownership to consumers. */
export function declaresPropagatingJavaScriptDependency(
  manifest: JavaScriptPackageManifest,
  packageName: string,
  packageDirectory: string
): boolean {
  return (
    manifest.dependencies?.[packageName] !== undefined ||
    declaresAvailableRequiredPeerDependency(
      manifest,
      packageName,
      packageDirectory
    )
  );
}

/** Lists required dependencies that can bind one workspace package to another. */
export function readWorkspaceDependencyNames(
  manifest: JavaScriptPackageManifest,
  packageDirectory: string
): string[] {
  const names = new Set<string>();
  for (const binding of readWorkspaceDependencyBindings(
    manifest,
    packageDirectory
  )) {
    names.add(binding.name);
    const workspaceAlias = parseWorkspaceDependencyAlias(binding.specifier);
    if (workspaceAlias) names.add(workspaceAlias.packageName);
    const npmAlias = parseNpmDependencyAlias(binding.specifier);
    if (npmAlias) names.add(npmAlias.packageName);
    if (binding.specifier.startsWith('catalog:')) {
      const installed = resolveInstalledJavaScriptPackage(
        packageDirectory,
        binding.name
      );
      if (typeof installed?.manifest.name === 'string') {
        names.add(installed.manifest.name);
      }
    }
    const localPackageName = readLocalDependencyPackageName(
      binding.specifier,
      packageDirectory
    );
    if (localPackageName) names.add(localPackageName);
  }
  return [...names];
}

/** Reads installed dependencies and resolvable, non-optional required peers. */
export function readWorkspaceDependencyBindings(
  manifest: JavaScriptPackageManifest,
  packageDirectory: string
): JavaScriptDependencyBinding[] {
  return readDependencyBindings(
    manifest,
    packageDirectory,
    INSTALLED_DEPENDENCY_FIELDS
  );
}

/** Reads dependency edges that may propagate wrapper ownership to consumers. */
export function readPropagatingDependencyBindings(
  manifest: JavaScriptPackageManifest,
  packageDirectory: string
): JavaScriptDependencyBinding[] {
  return readDependencyBindings(manifest, packageDirectory, ['dependencies']);
}

function readDependencyBindings(
  manifest: JavaScriptPackageManifest,
  packageDirectory: string,
  fields: readonly (typeof INSTALLED_DEPENDENCY_FIELDS)[number][]
): JavaScriptDependencyBinding[] {
  const bindings: JavaScriptDependencyBinding[] = [];
  const seenBindings = new Set<string>();
  const addBinding = (name: string, specifier: string) => {
    const key = `${name}\0${specifier}`;
    if (seenBindings.has(key)) return;
    seenBindings.add(key);
    bindings.push({ name, specifier });
  };
  for (const field of fields) {
    for (const [name, specifier] of Object.entries(manifest[field] ?? {})) {
      if (typeof specifier === 'string') addBinding(name, specifier);
    }
  }
  for (const [name, specifier] of Object.entries(
    manifest.peerDependencies ?? {}
  )) {
    if (
      typeof specifier === 'string' &&
      declaresAvailableRequiredPeerDependency(manifest, name, packageDirectory)
    ) {
      addBinding(name, specifier);
    }
  }
  return bindings;
}

/**
 * Resolves an installed package directory without selecting an export branch.
 *
 * `require.resolve()` is insufficient for availability checks because a valid
 * ESM package may intentionally expose only its `import` condition. Walking
 * Node's lookup directories finds the package boundary without importing user
 * code or depending on the package's public subpath exports.
 */
export function resolveInstalledJavaScriptPackage(
  directory: string,
  bindingName: string
): InstalledJavaScriptPackage | undefined {
  const packageSegments = readPackageNameSegments(bindingName);
  if (!packageSegments) return undefined;

  try {
    const localRequire = createRequire(
      path.join(path.resolve(directory), 'package.json')
    );
    for (const modulesDirectory of localRequire.resolve.paths(bindingName) ??
      []) {
      const candidate = path.join(modulesDirectory, ...packageSegments);
      let packageDirectory: string;
      try {
        packageDirectory = fs.realpathSync(candidate);
      } catch {
        continue;
      }
      const manifest = readJavaScriptPackageManifest(
        path.join(packageDirectory, 'package.json')
      );
      if (manifest) return { directory: packageDirectory, manifest };
    }
    try {
      const resolvedEntry = localRequire.resolve(bindingName);
      return findPackageBoundary(resolvedEntry);
    } catch {
      // ESM-only packages can omit a `require` export.
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function findPackageBoundary(
  entry: string
): InstalledJavaScriptPackage | undefined {
  if (!path.isAbsolute(entry)) return undefined;
  let directory = path.dirname(entry);
  while (true) {
    const manifest = readJavaScriptPackageManifest(
      path.join(directory, 'package.json')
    );
    if (manifest) return { directory, manifest };
    const parent = path.dirname(directory);
    if (parent === directory) return undefined;
    directory = parent;
  }
}

/** Parses pnpm's explicit `workspace:alias@range` dependency syntax. */
export function parseWorkspaceDependencyAlias(
  specifier: string
): { packageName: string; range: string } | undefined {
  if (!specifier.startsWith('workspace:')) return undefined;
  const value = specifier.slice('workspace:'.length);
  const separator = value.lastIndexOf('@');
  if (separator <= 0) return undefined;
  const packageName = value.slice(0, separator);
  const range = value.slice(separator + 1);
  if (!range || !readPackageNameSegments(packageName)) return undefined;
  return { packageName, range };
}

/** Reads the target package name from an npm alias dependency. */
export function parseNpmDependencyAlias(
  specifier: string
): { packageName: string; range?: string } | undefined {
  if (!specifier.startsWith('npm:')) return undefined;
  const value = specifier.slice('npm:'.length);
  const separator = value.lastIndexOf('@');
  const packageName = separator > 0 ? value.slice(0, separator) : value;
  if (!readPackageNameSegments(packageName)) return undefined;
  return {
    packageName,
    range: separator > 0 ? value.slice(separator + 1) : undefined,
  };
}

/** Reads a relative directory selected by an explicit local protocol. */
export function parseLocalDependencyPath(
  specifier: string
): string | undefined {
  const localPath = specifier.match(/^(?:file|link|portal):(.+)$/)?.[1];
  if (localPath) return localPath;
  return specifier.match(/^workspace:(\.{1,2}(?:\/.*)?)$/)?.[1];
}

/** Checks whether one binding's declared range accepts a selected package. */
export function dependencyBindingAcceptsPackageVersion(
  binding: JavaScriptDependencyBinding,
  packageName: string,
  packageVersion: string | undefined
): boolean {
  if (parseLocalDependencyPath(binding.specifier)) return true;

  const workspaceAlias = parseWorkspaceDependencyAlias(binding.specifier);
  if (workspaceAlias) {
    return (
      workspaceAlias.packageName === packageName &&
      workspaceRangeAcceptsVersion(workspaceAlias.range, packageVersion)
    );
  }

  const npmAlias = parseNpmDependencyAlias(binding.specifier);
  if (npmAlias) {
    return (
      npmAlias.packageName === packageName &&
      (npmAlias.range === undefined ||
        semverRangeAcceptsVersion(npmAlias.range, packageVersion, true))
    );
  }
  if (binding.specifier.startsWith('catalog:')) return true;
  if (binding.name !== packageName) return false;
  if (binding.specifier.startsWith('workspace:')) {
    return workspaceRangeAcceptsVersion(
      binding.specifier.slice('workspace:'.length),
      packageVersion
    );
  }
  return semverRangeAcceptsVersion(binding.specifier, packageVersion, true);
}

function canResolvePackage(directory: string, packageName: string): boolean {
  const installed = resolveInstalledJavaScriptPackage(directory, packageName);
  return installed?.manifest.name === packageName;
}

function declaresAvailableRequiredPeerDependency(
  manifest: JavaScriptPackageManifest,
  packageName: string,
  packageDirectory: string
): boolean {
  const specifier = manifest.peerDependencies?.[packageName];
  if (
    typeof specifier !== 'string' ||
    manifest.peerDependenciesMeta?.[packageName]?.optional === true
  ) {
    return false;
  }
  const installed = resolveInstalledJavaScriptPackage(
    packageDirectory,
    packageName
  );
  if (!installed) return false;
  const expectedName =
    parseWorkspaceDependencyAlias(specifier)?.packageName ??
    parseNpmDependencyAlias(specifier)?.packageName ??
    readLocalDependencyPackageName(specifier, packageDirectory);
  if (expectedName) return installed.manifest.name === expectedName;
  if (specifier.startsWith('catalog:')) {
    return typeof installed.manifest.name === 'string';
  }
  return installed.manifest.name === packageName;
}

function readPackageNameSegments(packageName: string): string[] | undefined {
  if (!packageName || packageName.includes('\\')) return undefined;
  const segments = packageName.split('/');
  const isScoped = packageName.startsWith('@');
  if (
    (isScoped && segments.length !== 2) ||
    (!isScoped && segments.length !== 1)
  ) {
    return undefined;
  }
  return segments.every(
    (segment) => segment && segment !== '.' && segment !== '..'
  )
    ? segments
    : undefined;
}

function readLocalDependencyPackageName(
  specifier: string,
  packageDirectory: string
): string | undefined {
  const localPath = parseLocalDependencyPath(specifier);
  if (!localPath) return undefined;
  const packageName = readJavaScriptPackageManifest(
    path.join(path.resolve(packageDirectory, localPath), 'package.json')
  )?.name;
  return typeof packageName === 'string' && packageName
    ? packageName
    : undefined;
}

function workspaceRangeAcceptsVersion(
  range: string,
  version: string | undefined
): boolean {
  return (
    range === '' ||
    range === '*' ||
    range === '^' ||
    range === '~' ||
    semverRangeAcceptsVersion(range, version, true)
  );
}

function semverRangeAcceptsVersion(
  range: string,
  version: string | undefined,
  acceptOpaqueRange = false
): boolean {
  const validRange = validSemverRange(range);
  if (!validRange) return acceptOpaqueRange;
  if (!version) return false;
  try {
    const validVersion = validSemver(version);
    return Boolean(validVersion && satisfiesSemver(validVersion, validRange));
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
