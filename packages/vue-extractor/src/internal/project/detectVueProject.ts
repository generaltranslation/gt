import fs from 'node:fs';
import path from 'node:path';
import {
  dependencyBindingAcceptsPackageVersion,
  declaresAvailableJavaScriptDependency,
  GT_VUE_PACKAGE,
  parseLocalDependencyPath,
  readJavaScriptPackageManifest,
  readWorkspaceDependencyBindings,
  resolveInstalledJavaScriptPackage,
  type JavaScriptDependencyBinding,
  type JavaScriptPackageManifest,
} from './manifest.js';
import { packagePubliclyExposesGT } from './wrapperProvenance.js';

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
  for (const binding of readWorkspaceDependencyBindings(
    rootManifest,
    projectRoot
  )) {
    const installed = resolveInstalledJavaScriptPackage(
      projectRoot,
      binding.name
    );
    if (!installed) continue;
    const sourceDirectory = findLocalSourceDirectory(
      binding,
      projectRoot,
      installed.directory,
      projectRoot
    );
    if (!sourceDirectory) continue;
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
    if (packagePubliclyExposesGT(sourceDirectory, sourceManifest)) return true;
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
