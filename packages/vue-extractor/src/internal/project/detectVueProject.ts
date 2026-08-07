import fs from 'node:fs';
import path from 'node:path';
import {
  dependencyBindingAcceptsPackageVersion,
  declaresAvailableJavaScriptDependency,
  declaresPropagatingJavaScriptDependency,
  GT_VUE_PACKAGE,
  parseLocalDependencyPath,
  readJavaScriptPackageManifest,
  readPropagatingDependencyBindings,
  readWorkspaceDependencyBindings,
  resolveInstalledJavaScriptPackage,
  type InstalledJavaScriptPackage,
  type JavaScriptDependencyBinding,
  type JavaScriptPackageManifest,
} from './manifest.js';

type LocalPackage = InstalledJavaScriptPackage & {
  includeDevelopmentBindings: boolean;
  sourceDirectory: string;
};

/**
 * Returns whether the root package owns gt-vue directly or through local code.
 *
 * Only installed bindings proven to originate inside the current project are
 * traversed. Registry packages and unrelated workspace descendants therefore
 * cannot change the root CLI mode, and ordinary projects never scan workspace
 * manifests or eagerly load the Vue parser and project-discovery graph.
 */
export function detectVueProject(cwd: string = process.cwd()): boolean {
  try {
    const projectRoot = normalizeDirectory(cwd);
    const rootManifest = readJavaScriptPackageManifest(
      path.join(projectRoot, 'package.json')
    );
    if (!rootManifest) return false;
    if (
      declaresAvailableJavaScriptDependency(
        rootManifest,
        GT_VUE_PACKAGE,
        projectRoot
      )
    ) {
      return true;
    }
    return localDependencyGraphDeclaresVue(rootManifest, projectRoot);
  } catch {
    return false;
  }
}

/** Checks only installed project-local dependency edges for a Vue wrapper. */
export function localDependencyGraphDeclaresVue(
  rootManifest: JavaScriptPackageManifest,
  projectRoot: string
): boolean {
  const pending: LocalPackage[] = [
    {
      directory: projectRoot,
      includeDevelopmentBindings: true,
      manifest: rootManifest,
      sourceDirectory: projectRoot,
    },
  ];
  const visited = new Set<string>([projectRoot]);
  for (let index = 0; index < pending.length; index += 1) {
    const current = pending[index]!;
    const bindings = current.includeDevelopmentBindings
      ? readWorkspaceDependencyBindings(current.manifest, current.directory)
      : readPropagatingDependencyBindings(current.manifest, current.directory);
    for (const binding of bindings) {
      const installed = resolveInstalledJavaScriptPackage(
        current.directory,
        binding.name
      );
      if (!installed) continue;
      const sourceDirectory = findLocalSourceDirectory(
        binding,
        current.sourceDirectory,
        installed.directory,
        projectRoot
      );
      if (!sourceDirectory || visited.has(sourceDirectory)) continue;
      const sourceManifest = readJavaScriptPackageManifest(
        path.join(sourceDirectory, 'package.json')
      );
      const packageName = readPackageName(sourceManifest);
      if (
        !sourceManifest ||
        !packageName ||
        !dependencyBindingAcceptsPackageVersion(
          binding,
          packageName,
          sourceManifest.version
        )
      ) {
        continue;
      }
      if (
        declaresPropagatingJavaScriptDependency(
          sourceManifest,
          GT_VUE_PACKAGE,
          installed.directory
        )
      ) {
        return true;
      }
      visited.add(sourceDirectory);
      pending.push({
        directory: installed.directory,
        includeDevelopmentBindings: false,
        manifest: sourceManifest,
        sourceDirectory,
      });
    }
  }
  return false;
}

function findLocalSourceDirectory(
  binding: JavaScriptDependencyBinding,
  importerSourceDirectory: string,
  installedDirectory: string,
  projectRoot: string
): string | undefined {
  const localPath = parseLocalDependencyPath(binding.specifier);
  if (localPath) {
    const sourceDirectory = normalizeDirectory(
      path.resolve(importerSourceDirectory, localPath)
    );
    if (isLocalSourceDirectory(projectRoot, sourceDirectory)) {
      return sourceDirectory;
    }
  }

  const normalizedInstalled = normalizeDirectory(installedDirectory);
  if (isLocalSourceDirectory(projectRoot, normalizedInstalled)) {
    return normalizedInstalled;
  }
  return undefined;
}

function isLocalSourceDirectory(
  projectRoot: string,
  candidate: string
): boolean {
  const relative = path.relative(projectRoot, candidate);
  return (
    relative !== '' &&
    relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative) &&
    !relative.split(path.sep).includes('node_modules') &&
    fs.existsSync(path.join(candidate, 'package.json'))
  );
}

function normalizeDirectory(directory: string): string {
  try {
    return fs.realpathSync(directory);
  } catch {
    return path.resolve(directory);
  }
}

function readPackageName(
  manifest: JavaScriptPackageManifest | undefined
): string | undefined {
  return typeof manifest?.name === 'string' && manifest.name
    ? manifest.name
    : undefined;
}
