import fs from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';
import {
  createWorkspaceDiscoveryCache,
  readDeclaredWorkspacePackages,
  type DeclaredWorkspacePackage,
  type WorkspaceDiscoveryCache,
} from './workspaces.js';
import {
  dependencyBindingAcceptsPackageVersion,
  declaresAvailableJavaScriptDependency,
  declaresWorkspaceJavaScriptDependency,
  GT_VUE_PACKAGE,
  parseLocalDependencyPath,
  parseNpmDependencyAlias,
  parseWorkspaceDependencyAlias,
  readPropagatingDependencyBindings,
  readWorkspaceDependencyBindings,
  readWorkspaceDependencyNames,
  readJavaScriptPackageManifest,
  resolveInstalledJavaScriptPackage,
  type JavaScriptDependencyBinding,
  type JavaScriptPackageManifest,
} from './manifest.js';
import { localDependencyGraphDeclaresVue } from './detectVueProject.js';
import {
  createConsumerUsageCache,
  packageConsumesPublicGT,
  packageExposesPublicGT,
  type ConsumerUsageCache,
} from './consumerUsage.js';
import { DEFAULT_VUE_SOURCE_PATTERNS } from './sourcePatterns.js';

export { DEFAULT_VUE_SOURCE_PATTERNS } from './sourcePatterns.js';

/** One package boundary whose sources share Vue build configuration. */
export type VueSourceScope = {
  directory: string;
  includeByDefault: boolean;
  relativeDirectory: string;
};

/** Project discovery result reused by detection and extraction. */
export type VueProjectDiscovery = {
  projectRoot: string;
  rootOwnsVue: boolean;
  rootManifest?: JavaScriptPackageManifest;
  scopes: VueSourceScope[];
};

/**
 * Discovers only packages that own gt-vue or consume a selected local wrapper.
 *
 * An aggregator root is not scanned merely because one child uses Vue. It is
 * included only when it directly declares gt-vue or depends on a proven local
 * wrapper. This is the boundary that prevents Vue support from broadening
 * existing React source discovery.
 */
export function discoverVueProject(
  cwd: string,
  cache: WorkspaceDiscoveryCache = createWorkspaceDiscoveryCache()
): VueProjectDiscovery {
  const projectRoot = resolveProjectDirectory(cwd);
  const rootManifest = readJavaScriptPackageManifest(
    path.join(projectRoot, 'package.json')
  );
  if (!rootManifest) {
    return { projectRoot, rootOwnsVue: false, scopes: [] };
  }

  const workspacePackages = readDeclaredWorkspacePackages(
    projectRoot,
    rootManifest,
    cache
  );
  const consumerUsageCache = createConsumerUsageCache();
  const workspaceSelection = selectVueWorkspacePackages(
    workspacePackages,
    rootManifest,
    projectRoot,
    consumerUsageCache
  );
  const selectedWorkspacePackages = workspaceSelection.packages;
  const rootDeclaresVue = declaresAvailableJavaScriptDependency(
    rootManifest,
    GT_VUE_PACKAGE,
    projectRoot
  );
  const rootConsumesVueWrapper = consumesSelectedWorkspace(
    { directory: projectRoot, manifest: rootManifest },
    selectedWorkspacePackages.filter(({ directory }) =>
      workspaceSelection.propagatingDirectories.has(directory)
    ),
    consumerUsageCache
  );
  const rootConsumesLocalVueWrapper = localDependencyGraphDeclaresVue(
    rootManifest,
    projectRoot,
    consumerUsageCache
  );
  const scopes: VueSourceScope[] = [];

  const rootOwnsVue =
    rootDeclaresVue || rootConsumesVueWrapper || rootConsumesLocalVueWrapper;
  if (rootOwnsVue) {
    scopes.push({
      directory: projectRoot,
      includeByDefault: true,
      relativeDirectory: '',
    });
  }
  for (const { directory } of selectedWorkspacePackages) {
    const relativeDirectory = toPosixPath(
      path.relative(projectRoot, directory)
    );
    if (
      !relativeDirectory ||
      relativeDirectory === '..' ||
      relativeDirectory.startsWith('../')
    ) {
      continue;
    }
    scopes.push({
      directory,
      includeByDefault: true,
      relativeDirectory,
    });
  }

  return { projectRoot, rootManifest, rootOwnsVue, scopes };
}

/** Canonicalizes existing roots so macOS path aliases share one ownership tree. */
export function resolveProjectDirectory(directory: string): string {
  try {
    return fs.realpathSync(path.resolve(directory));
  } catch {
    return path.resolve(directory);
  }
}

/** Returns safe project-root-relative default globs for selected Vue scopes. */
export function readDefaultVueSourcePatterns(
  scopes: readonly VueSourceScope[]
): string[] {
  const patterns = scopes.flatMap(({ includeByDefault, relativeDirectory }) => {
    if (!includeByDefault) return [];
    if (!relativeDirectory) return [...DEFAULT_VUE_SOURCE_PATTERNS];
    const literalDirectory = fg.escapePath(relativeDirectory);
    return DEFAULT_VUE_SOURCE_PATTERNS.map(
      (pattern) => `${literalDirectory}/${pattern}`
    );
  });
  return [...new Set(patterns)];
}

/** Selects the deepest declared Vue package containing a source file. */
export function findVueSourceScope(
  file: string,
  scopes: readonly VueSourceScope[]
): VueSourceScope | undefined {
  return [...scopes]
    .sort((left, right) => right.directory.length - left.directory.length)
    .find(({ directory }) => isWithin(directory, file));
}

function selectVueWorkspacePackages(
  workspacePackages: readonly DeclaredWorkspacePackage[],
  rootManifest: JavaScriptPackageManifest,
  projectRoot: string,
  consumerUsageCache: ConsumerUsageCache
): {
  packages: DeclaredWorkspacePackage[];
  propagatingDirectories: Set<string>;
} {
  const selectedDirectories = new Set<string>();
  const propagatingDirectories = new Set<string>();
  const queuedPropagators = new Set<string>();
  const pendingPackages: DeclaredWorkspacePackage[] = [];
  const publicGTByDirectory = new Map<string, boolean>();
  const publiclyExposesGT = ({
    directory,
    manifest,
  }: DeclaredWorkspacePackage): boolean => {
    const cached = publicGTByDirectory.get(directory);
    if (cached !== undefined) return cached;
    const exposesGT = packageExposesPublicGT(
      directory,
      manifest,
      consumerUsageCache
    );
    publicGTByDirectory.set(directory, exposesGT);
    return exposesGT;
  };
  const selectPackage = (
    selectedPackage: DeclaredWorkspacePackage,
    propagates: boolean
  ) => {
    selectedDirectories.add(selectedPackage.directory);
    if (!propagates || queuedPropagators.has(selectedPackage.directory)) {
      return;
    }
    propagatingDirectories.add(selectedPackage.directory);
    queuedPropagators.add(selectedPackage.directory);
    pendingPackages.push(selectedPackage);
  };
  if (
    declaresAvailableJavaScriptDependency(
      rootManifest,
      GT_VUE_PACKAGE,
      projectRoot
    )
  ) {
    selectPackage(
      { directory: projectRoot, manifest: rootManifest },
      publiclyExposesGT({ directory: projectRoot, manifest: rootManifest })
    );
  }
  for (const workspacePackage of workspacePackages) {
    if (
      !declaresWorkspaceJavaScriptDependency(
        workspacePackage.manifest,
        GT_VUE_PACKAGE,
        workspacePackage.directory
      )
    ) {
      continue;
    }
    selectPackage(workspacePackage, publiclyExposesGT(workspacePackage));
  }

  // A pure non-Vue workspace has no ownership seed to propagate. Avoid
  // walking every dependency edge after the manifest scan has already proved
  // that no package directly owns gt-vue.
  if (pendingPackages.length === 0) {
    return {
      packages: workspacePackages.filter(({ directory }) =>
        selectedDirectories.has(directory)
      ),
      propagatingDirectories,
    };
  }

  const consumersByDependency = new Map<string, DeclaredWorkspacePackage[]>();
  for (const workspacePackage of workspacePackages) {
    for (const dependencyName of readWorkspaceDependencyNames(
      workspacePackage.manifest,
      workspacePackage.directory
    )) {
      const consumers = consumersByDependency.get(dependencyName) ?? [];
      consumers.push(workspacePackage);
      consumersByDependency.set(dependencyName, consumers);
    }
  }

  for (let index = 0; index < pendingPackages.length; index += 1) {
    const selectedPackage = pendingPackages[index]!;
    const selectedName = readPackageName(selectedPackage.manifest);
    if (!selectedName) continue;
    for (const consumer of consumersByDependency.get(selectedName) ?? []) {
      if (propagatingDirectories.has(consumer.directory)) continue;
      if (
        !consumesCompatibleWorkspace(
          consumer,
          selectedPackage,
          false,
          consumerUsageCache
        )
      ) {
        continue;
      }
      selectPackage(
        consumer,
        consumesCompatibleWorkspace(
          consumer,
          selectedPackage,
          true,
          consumerUsageCache
        ) && publiclyExposesGT(consumer)
      );
    }
  }

  return {
    packages: workspacePackages.filter(({ directory }) =>
      selectedDirectories.has(directory)
    ),
    propagatingDirectories,
  };
}

function consumesSelectedWorkspace(
  consumer: DeclaredWorkspacePackage,
  selectedPackages: readonly DeclaredWorkspacePackage[],
  consumerUsageCache: ConsumerUsageCache
): boolean {
  return selectedPackages.some((selectedPackage) =>
    consumesCompatibleWorkspace(
      consumer,
      selectedPackage,
      false,
      consumerUsageCache
    )
  );
}

/** Checks that a compatible dependency edge is used by consumer source. */
function consumesCompatibleWorkspace(
  consumer: DeclaredWorkspacePackage,
  selected: DeclaredWorkspacePackage,
  propagatingOnly: boolean,
  consumerUsageCache: ConsumerUsageCache
): boolean {
  const packageName = readPackageName(selected.manifest);
  if (!packageName) return false;
  const bindings = propagatingOnly
    ? readPropagatingDependencyBindings(consumer.manifest, consumer.directory)
    : readWorkspaceDependencyBindings(consumer.manifest, consumer.directory);
  return bindings.some(
    (binding) =>
      dependencyBindingMatchesWorkspace(
        binding,
        packageName,
        selected,
        consumer.directory
      ) &&
      packageConsumesPublicGT(
        consumer.directory,
        binding.name,
        selected.directory,
        selected.manifest,
        consumerUsageCache
      )
  );
}

function dependencyBindingMatchesWorkspace(
  binding: JavaScriptDependencyBinding,
  workspaceName: string,
  selected: DeclaredWorkspacePackage,
  consumerDirectory: string
): boolean {
  const workspaceAlias = parseWorkspaceDependencyAlias(binding.specifier);
  const npmAlias = parseNpmDependencyAlias(binding.specifier);
  const catalogPackage = binding.specifier.startsWith('catalog:')
    ? resolveInstalledJavaScriptPackage(consumerDirectory, binding.name)
    : undefined;
  const namesWorkspace = binding.name === workspaceName;
  const aliasesWorkspace =
    workspaceAlias?.packageName === workspaceName ||
    npmAlias?.packageName === workspaceName ||
    catalogPackage?.manifest.name === workspaceName;
  const localPath = parseLocalDependencyPath(binding.specifier);

  if (localPath) {
    return pathsIdentifySameDirectory(
      path.resolve(consumerDirectory, localPath),
      selected.directory
    );
  }
  if (!namesWorkspace && !aliasesWorkspace) return false;
  if (
    !dependencyBindingAcceptsPackageVersion(
      binding,
      workspaceName,
      selected.manifest.version
    )
  ) {
    return false;
  }

  const installed =
    catalogPackage ??
    resolveInstalledJavaScriptPackage(consumerDirectory, binding.name);
  if (
    installed &&
    pathsIdentifySameDirectory(installed.directory, selected.directory)
  ) {
    return true;
  }

  if (workspaceAlias?.packageName === workspaceName) {
    return true;
  }
  if (namesWorkspace && binding.specifier.startsWith('workspace:')) {
    return true;
  }
  // Bare semver, catalogs, and npm aliases may resolve to a registry package.
  // They select a local wrapper only when the installed binding proves it.
  return false;
}

function pathsIdentifySameDirectory(left: string, right: string): boolean {
  try {
    return fs.realpathSync(left) === fs.realpathSync(right);
  } catch {
    return path.resolve(left) === path.resolve(right);
  }
}

function readPackageName(
  manifest: JavaScriptPackageManifest
): string | undefined {
  return typeof manifest.name === 'string' && manifest.name
    ? manifest.name
    : undefined;
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

function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join(path.posix.sep);
}
