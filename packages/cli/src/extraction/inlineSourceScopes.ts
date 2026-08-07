import path from 'node:path';
import fg from 'fast-glob';
import {
  DEFAULT_SRC_PATTERNS,
  DEFAULT_VUE_SRC_PATTERNS,
} from '../config/generateSettings.js';
import {
  declaresJavaScriptDependency,
  readDeclaredWorkspacePackages,
  readJavaScriptPackageManifest,
  type DeclaredWorkspacePackage,
  type JavaScriptPackageManifest,
} from '../fs/determineFramework/workspacePackages.js';
import { Libraries, type InlineLibrary } from '../types/libraries.js';

/** One project boundary whose source files share framework configuration. */
export type InlineSourceScope = {
  /** Absolute package directory. */
  directory: string;
  /** Whether implicit source discovery should scan this package. */
  includeByDefault: boolean;
  /** Project-root-relative package directory, or an empty string for root. */
  relativeDirectory: string;
};

/**
 * Returns the root project and declared workspaces selected for one library.
 *
 * Workspace directories come from the same realpath-validated traversal used
 * by library detection, keeping package selection and source discovery aligned.
 * Vue selection also includes local dependents of a gt-vue owner so an app can
 * consume the runtime exclusively through a workspace barrel. Other runtimes
 * retain their historical root-only defaults when the root declares them;
 * workspace owners are selected only for an aggregator root.
 */
export function readInlineSourceScopes(
  projectRoot: string,
  library: InlineLibrary
): InlineSourceScope[] {
  const rootScope: InlineSourceScope = {
    directory: projectRoot,
    includeByDefault: true,
    relativeDirectory: '',
  };
  const rootManifest = readJavaScriptPackageManifest(
    path.join(projectRoot, 'package.json')
  );
  if (!rootManifest) return [rootScope];

  if (
    library !== Libraries.GT_VUE &&
    declaresJavaScriptDependency(rootManifest, library)
  ) {
    return [rootScope];
  }

  const workspacePackages = readDeclaredWorkspacePackages(
    projectRoot,
    rootManifest
  );
  const selectedWorkspacePackages =
    library === Libraries.GT_VUE
      ? selectVueWorkspacePackages(workspacePackages, rootManifest)
      : declaresJavaScriptDependency(rootManifest, library)
        ? []
        : workspacePackages.filter(({ manifest }) =>
            declaresJavaScriptDependency(manifest, library)
          );
  rootScope.includeByDefault =
    declaresJavaScriptDependency(rootManifest, library) ||
    (library === Libraries.GT_VUE &&
      rootConsumesSelectedVuePackage(rootManifest, selectedWorkspacePackages));
  const workspaceScopes = selectedWorkspacePackages
    .map(({ directory }) => ({
      directory,
      includeByDefault: true,
      relativeDirectory: toPosixPath(path.relative(projectRoot, directory)),
    }))
    .filter(
      ({ relativeDirectory }) =>
        relativeDirectory !== '' &&
        relativeDirectory !== '..' &&
        !relativeDirectory.startsWith('../')
    );

  return [rootScope, ...workspaceScopes];
}

/** Returns whether the root consumes a selected local gt-vue wrapper. */
function rootConsumesSelectedVuePackage(
  rootManifest: JavaScriptPackageManifest,
  selectedPackages: readonly DeclaredWorkspacePackage[]
): boolean {
  const selectedNames = new Set(
    selectedPackages
      .map(({ manifest }) => readPackageName(manifest))
      .filter((name): name is string => name !== undefined)
  );
  return readDeclaredDependencyNames(rootManifest).some((name) =>
    selectedNames.has(name)
  );
}

/**
 * Selects Vue workspaces that own gt-vue or consume a selected local wrapper.
 *
 * A workspace can legally import every GT API from another workspace's ESM
 * barrel without declaring `gt-vue` itself. Follow reverse local dependency
 * edges so those consumers are discovered while unrelated workspaces remain
 * excluded. React selection deliberately keeps its existing direct-owner
 * behavior.
 */
function selectVueWorkspacePackages(
  workspacePackages: readonly DeclaredWorkspacePackage[],
  rootManifest: JavaScriptPackageManifest
): DeclaredWorkspacePackage[] {
  const selectedDirectories = new Set(
    workspacePackages
      .filter(({ manifest }) =>
        declaresJavaScriptDependency(manifest, Libraries.GT_VUE)
      )
      .map(({ directory }) => directory)
  );
  const selectedPackageNames = new Set<string>();
  const pendingPackageNames: string[] = [];
  const addSelectedPackageName = (manifest: JavaScriptPackageManifest) => {
    const packageName = readPackageName(manifest);
    if (!packageName || selectedPackageNames.has(packageName)) return;
    selectedPackageNames.add(packageName);
    pendingPackageNames.push(packageName);
  };
  if (declaresJavaScriptDependency(rootManifest, Libraries.GT_VUE)) {
    addSelectedPackageName(rootManifest);
  }
  for (const workspacePackage of workspacePackages) {
    if (selectedDirectories.has(workspacePackage.directory)) {
      addSelectedPackageName(workspacePackage.manifest);
    }
  }

  const consumersByDependency = new Map<string, DeclaredWorkspacePackage[]>();
  for (const workspacePackage of workspacePackages) {
    for (const dependencyName of readDeclaredDependencyNames(
      workspacePackage.manifest
    )) {
      const consumers = consumersByDependency.get(dependencyName) ?? [];
      consumers.push(workspacePackage);
      consumersByDependency.set(dependencyName, consumers);
    }
  }

  for (let index = 0; index < pendingPackageNames.length; index += 1) {
    const packageName = pendingPackageNames[index]!;
    for (const consumer of consumersByDependency.get(packageName) ?? []) {
      if (!selectedDirectories.has(consumer.directory)) {
        selectedDirectories.add(consumer.directory);
        addSelectedPackageName(consumer.manifest);
      }
    }
  }

  return workspacePackages.filter(({ directory }) =>
    selectedDirectories.has(directory)
  );
}

/** Returns a validated workspace name from an otherwise permissive manifest. */
function readPackageName(
  manifest: JavaScriptPackageManifest
): string | undefined {
  return typeof manifest.name === 'string' && manifest.name
    ? manifest.name
    : undefined;
}

/** Lists dependency keys across every field used for framework detection. */
function readDeclaredDependencyNames(
  manifest: JavaScriptPackageManifest
): string[] {
  const names = new Set<string>();
  for (const dependencies of [
    manifest.dependencies,
    manifest.devDependencies,
    manifest.optionalDependencies,
    manifest.peerDependencies,
  ]) {
    if (!dependencies || typeof dependencies !== 'object') continue;
    for (const packageName of Object.keys(dependencies)) {
      names.add(packageName);
    }
  }
  return [...names];
}

/**
 * Builds safe default globs for the root and every workspace selected above.
 *
 * Package-directory prefixes are escaped as literal paths so legal names such
 * as `vue[1]` cannot select a different workspace through glob semantics.
 */
export function readDefaultInlineSourcePatterns(
  projectRoot: string,
  library: InlineLibrary,
  scopes: readonly InlineSourceScope[] = readInlineSourceScopes(
    projectRoot,
    library
  )
): string[] {
  const sourcePatterns =
    library === Libraries.GT_VUE
      ? DEFAULT_VUE_SRC_PATTERNS
      : DEFAULT_SRC_PATTERNS;
  const patterns = scopes
    .filter(({ includeByDefault }) => includeByDefault)
    .flatMap(({ relativeDirectory }) => {
      if (!relativeDirectory) return sourcePatterns;
      const literalDirectory = fg.escapePath(relativeDirectory);
      return sourcePatterns.map((pattern) => `${literalDirectory}/${pattern}`);
    });
  return [...new Set(patterns)];
}

/** Selects the deepest declared package scope containing a source file. */
export function findInlineSourceScope(
  file: string,
  scopes: readonly InlineSourceScope[]
): InlineSourceScope {
  const orderedScopes = [...scopes].sort(
    (left, right) => right.directory.length - left.directory.length
  );
  return (
    orderedScopes.find(({ directory }) => isWithin(directory, file)) ??
    scopes[0]
  );
}

function isWithin(directory: string, file: string): boolean {
  const relative = path.relative(path.resolve(directory), path.resolve(file));
  return (
    relative !== '' &&
    relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

function toPosixPath(filepath: string): string {
  return filepath.split(path.sep).join(path.posix.sep);
}
