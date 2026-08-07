import fs from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';
import { satisfies as satisfiesSemver, valid as validSemver } from 'semver';
import {
  createWorkspaceDiscoveryCache,
  readDeclaredWorkspacePackages,
  type DeclaredWorkspacePackage,
  type WorkspaceDiscoveryCache,
} from './workspaces.js';
import {
  declaresAvailableJavaScriptDependency,
  declaresWorkspaceJavaScriptDependency,
  GT_VUE_PACKAGE,
  readWorkspaceDependencyNames,
  readWorkspaceDependencySpecifiers,
  readJavaScriptPackageManifest,
  type JavaScriptPackageManifest,
} from './manifest.js';

/** Default Vue source patterns, including conventional Vue and Nuxt folders. */
export const DEFAULT_VUE_SOURCE_PATTERNS = [
  '*.vue',
  'src/**/*.{vue,js,jsx,mjs,cjs,ts,tsx,mts,cts}',
  'app/**/*.{vue,js,jsx,mjs,cjs,ts,tsx,mts,cts}',
  'pages/**/*.{vue,js,jsx,mjs,cjs,ts,tsx,mts,cts}',
  'components/**/*.{vue,js,jsx,mjs,cjs,ts,tsx,mts,cts}',
  '{composables,layers,layouts,middleware,modules,plugins,server,shared,stores,utils,views}/**/*.{vue,js,jsx,mjs,cjs,ts,tsx,mts,cts}',
] as const;

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
 * included only when it directly declares gt-vue or depends on a selected
 * workspace wrapper. This is the boundary that prevents Vue support from
 * broadening existing React source discovery.
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
  const selectedWorkspacePackages = selectVueWorkspacePackages(
    workspacePackages,
    rootManifest,
    projectRoot
  );
  const rootOwnsVue = declaresAvailableJavaScriptDependency(
    rootManifest,
    GT_VUE_PACKAGE,
    projectRoot
  );
  const rootConsumesVueWrapper = consumesSelectedWorkspace(
    { directory: projectRoot, manifest: rootManifest },
    selectedWorkspacePackages
  );
  const scopes: VueSourceScope[] = [];

  if (rootOwnsVue || rootConsumesVueWrapper) {
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
  projectRoot: string
): DeclaredWorkspacePackage[] {
  const selectedDirectories = new Set(
    workspacePackages
      .filter(({ directory, manifest }) =>
        declaresWorkspaceJavaScriptDependency(
          manifest,
          GT_VUE_PACKAGE,
          directory
        )
      )
      .map(({ directory }) => directory)
  );
  const selectedNames = new Set<string>();
  const pendingPackages: DeclaredWorkspacePackage[] = [];
  const selectPackage = (selectedPackage: DeclaredWorkspacePackage) => {
    const packageName = readPackageName(selectedPackage.manifest);
    if (!packageName || selectedNames.has(packageName)) return;
    selectedNames.add(packageName);
    pendingPackages.push(selectedPackage);
  };
  if (
    declaresAvailableJavaScriptDependency(
      rootManifest,
      GT_VUE_PACKAGE,
      projectRoot
    )
  ) {
    selectPackage({ directory: projectRoot, manifest: rootManifest });
  }
  for (const workspacePackage of workspacePackages) {
    if (selectedDirectories.has(workspacePackage.directory)) {
      selectPackage(workspacePackage);
    }
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
      if (selectedDirectories.has(consumer.directory)) continue;
      if (!dependsOnCompatibleWorkspace(consumer, selectedPackage)) {
        continue;
      }
      selectedDirectories.add(consumer.directory);
      selectPackage(consumer);
    }
  }

  return workspacePackages.filter(({ directory }) =>
    selectedDirectories.has(directory)
  );
}

function consumesSelectedWorkspace(
  consumer: DeclaredWorkspacePackage,
  selectedPackages: readonly DeclaredWorkspacePackage[]
): boolean {
  return selectedPackages.some((selectedPackage) =>
    dependsOnCompatibleWorkspace(consumer, selectedPackage)
  );
}

/** Checks that a consumer's declared range can resolve to the local package. */
function dependsOnCompatibleWorkspace(
  consumer: DeclaredWorkspacePackage,
  selected: DeclaredWorkspacePackage
): boolean {
  const packageName = readPackageName(selected.manifest);
  if (!packageName) return false;
  return readWorkspaceDependencySpecifiers(
    consumer.manifest,
    packageName,
    consumer.directory
  ).some((specifier) =>
    workspaceSpecifierMatches(
      specifier,
      selected.manifest.version,
      consumer.directory,
      selected.directory
    )
  );
}

function workspaceSpecifierMatches(
  specifier: string,
  workspaceVersion: string | undefined,
  consumerDirectory: string,
  selectedDirectory: string
): boolean {
  const normalized = specifier.trim();
  if (!normalized) return false;
  const localPath = normalized.match(/^(?:file|link|portal):(.+)$/)?.[1];
  if (localPath) {
    return pathsIdentifySameDirectory(
      path.resolve(consumerDirectory, localPath),
      selectedDirectory
    );
  }

  const usesWorkspaceProtocol = normalized.startsWith('workspace:');
  const workspaceRange = usesWorkspaceProtocol
    ? normalized.slice('workspace:'.length)
    : normalized;
  if (usesWorkspaceProtocol && /^\.{1,2}(?:\/|$)/.test(workspaceRange)) {
    return pathsIdentifySameDirectory(
      path.resolve(consumerDirectory, workspaceRange),
      selectedDirectory
    );
  }
  if (
    usesWorkspaceProtocol &&
    (workspaceRange === '*' || workspaceRange === '^' || workspaceRange === '~')
  ) {
    return true;
  }

  const version = workspaceVersion ? validSemver(workspaceVersion) : null;
  if (!version) return false;
  try {
    return satisfiesSemver(version, workspaceRange);
  } catch {
    return false;
  }
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
