import path from 'node:path';
import fg from 'fast-glob';
import {
  createWorkspaceDiscoveryCache,
  declaresJavaScriptDependency,
  readDeclaredDependencyNames,
  readDeclaredWorkspacePackages,
  readJavaScriptPackageManifest,
  type DeclaredWorkspacePackage,
  type JavaScriptPackageManifest,
  type WorkspaceDiscoveryCache,
} from './workspaces.js';

/** Runtime package whose ownership selects Vue extraction scopes. */
export const GT_VUE_PACKAGE = 'gt-vue';

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
  const projectRoot = path.resolve(cwd);
  const rootManifest = readJavaScriptPackageManifest(
    path.join(projectRoot, 'package.json')
  );
  if (!rootManifest) {
    return { projectRoot, scopes: [] };
  }

  const workspacePackages = readDeclaredWorkspacePackages(
    projectRoot,
    rootManifest,
    cache
  );
  const selectedWorkspacePackages = selectVueWorkspacePackages(
    workspacePackages,
    rootManifest
  );
  const rootOwnsVue = declaresJavaScriptDependency(
    rootManifest,
    GT_VUE_PACKAGE
  );
  const rootConsumesVueWrapper = consumesSelectedWorkspace(
    rootManifest,
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

  return { projectRoot, rootManifest, scopes };
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
  rootManifest: JavaScriptPackageManifest
): DeclaredWorkspacePackage[] {
  const selectedDirectories = new Set(
    workspacePackages
      .filter(({ manifest }) =>
        declaresJavaScriptDependency(manifest, GT_VUE_PACKAGE)
      )
      .map(({ directory }) => directory)
  );
  const selectedNames = new Set<string>();
  const pendingNames: string[] = [];
  const selectName = (manifest: JavaScriptPackageManifest) => {
    const packageName = readPackageName(manifest);
    if (!packageName || selectedNames.has(packageName)) return;
    selectedNames.add(packageName);
    pendingNames.push(packageName);
  };
  if (declaresJavaScriptDependency(rootManifest, GT_VUE_PACKAGE)) {
    selectName(rootManifest);
  }
  for (const workspacePackage of workspacePackages) {
    if (selectedDirectories.has(workspacePackage.directory)) {
      selectName(workspacePackage.manifest);
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

  for (let index = 0; index < pendingNames.length; index += 1) {
    for (const consumer of consumersByDependency.get(pendingNames[index]!) ??
      []) {
      if (selectedDirectories.has(consumer.directory)) continue;
      selectedDirectories.add(consumer.directory);
      selectName(consumer.manifest);
    }
  }

  return workspacePackages.filter(({ directory }) =>
    selectedDirectories.has(directory)
  );
}

function consumesSelectedWorkspace(
  manifest: JavaScriptPackageManifest,
  selectedPackages: readonly DeclaredWorkspacePackage[]
): boolean {
  const selectedNames = new Set(
    selectedPackages
      .map(({ manifest: selectedManifest }) =>
        readPackageName(selectedManifest)
      )
      .filter((name): name is string => name !== undefined)
  );
  return readDeclaredDependencyNames(manifest).some((name) =>
    selectedNames.has(name)
  );
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
