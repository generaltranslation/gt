import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

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

/** Lists required dependencies that can bind one workspace package to another. */
export function readWorkspaceDependencyNames(
  manifest: JavaScriptPackageManifest,
  packageDirectory: string
): string[] {
  const names = new Set<string>();
  for (const field of INSTALLED_DEPENDENCY_FIELDS) {
    for (const packageName of Object.keys(manifest[field] ?? {})) {
      names.add(packageName);
    }
  }
  for (const packageName of Object.keys(manifest.peerDependencies ?? {})) {
    if (
      declaresAvailableRequiredPeerDependency(
        manifest,
        packageName,
        packageDirectory
      )
    ) {
      names.add(packageName);
    }
  }
  return [...names];
}

/** Reads installed and resolvable required-peer ranges for one dependency. */
export function readWorkspaceDependencySpecifiers(
  manifest: JavaScriptPackageManifest,
  packageName: string,
  packageDirectory: string
): string[] {
  const specifiers = new Set<string>();
  for (const field of INSTALLED_DEPENDENCY_FIELDS) {
    const specifier = manifest[field]?.[packageName];
    if (typeof specifier === 'string') specifiers.add(specifier);
  }
  if (
    declaresAvailableRequiredPeerDependency(
      manifest,
      packageName,
      packageDirectory
    )
  ) {
    const peerSpecifier = manifest.peerDependencies?.[packageName];
    if (typeof peerSpecifier === 'string') specifiers.add(peerSpecifier);
  }
  return [...specifiers];
}

function canResolvePackage(directory: string, packageName: string): boolean {
  try {
    createRequire(path.join(path.resolve(directory), 'package.json')).resolve(
      packageName
    );
    return true;
  } catch {
    return false;
  }
}

function declaresAvailableRequiredPeerDependency(
  manifest: JavaScriptPackageManifest,
  packageName: string,
  packageDirectory: string
): boolean {
  return Boolean(
    manifest.peerDependencies?.[packageName] !== undefined &&
    manifest.peerDependenciesMeta?.[packageName]?.optional !== true &&
    canResolvePackage(packageDirectory, packageName)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
