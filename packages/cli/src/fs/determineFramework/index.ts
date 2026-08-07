import path from 'node:path';
import fs from 'node:fs';
import { SupportedLibraries } from '../../types/index.js';
import { logger } from '../../console/logger.js';
import { Libraries } from '../../types/libraries.js';
import { detectPythonLibrary } from './detectPythonLibrary.js';
import {
  readDeclaredWorkspaceManifests,
  type JavaScriptPackageManifest,
} from './workspacePackages.js';

const INLINE_JAVASCRIPT_LIBRARY_PRIORITY = [
  Libraries.GT_NEXT,
  Libraries.GT_TANSTACK_START,
  Libraries.GT_REACT,
  Libraries.GT_REACT_NATIVE,
  Libraries.GT_VUE,
  Libraries.GT_NODE,
] as const;

const JAVASCRIPT_LIBRARY_PRIORITY = [
  ...INLINE_JAVASCRIPT_LIBRARY_PRIORITY,
  'next-intl',
  'i18next',
] as const satisfies readonly SupportedLibraries[];

export function determineLibrary(): {
  library: SupportedLibraries;
  additionalModules: SupportedLibraries[];
} {
  try {
    // Get the current working directory (where the CLI is being run)
    const cwd = process.cwd();
    const packageJsonPath = path.join(cwd, 'package.json');
    let rootDependencies: Record<string, string> = {};
    let rootPrimaryDependencies: Record<string, string> = {};
    let aggregatePrimaryDependencies: Record<string, string> = {};
    let rootJavaScriptLibrary: SupportedLibraries | undefined;
    let aggregateDependencies: Record<string, string> = {};

    // Check if package.json exists
    if (fs.existsSync(packageJsonPath)) {
      // Read and parse package.json
      const packageJson = JSON.parse(
        fs.readFileSync(packageJsonPath, 'utf8')
      ) as JavaScriptPackageManifest;
      rootPrimaryDependencies = getPrimaryJavaScriptDependencies(packageJson);
      rootDependencies = getJavaScriptDependencies(packageJson);
      rootJavaScriptLibrary =
        detectJavaScriptLibrary(rootPrimaryDependencies) ??
        detectDeclaredVueLibrary(rootDependencies);
      const manifests = readDeclaredWorkspaceManifests(cwd, packageJson);
      aggregatePrimaryDependencies = Object.assign(
        {},
        rootPrimaryDependencies,
        ...manifests.map(getPrimaryJavaScriptDependencies)
      ) as Record<string, string>;
      aggregateDependencies = Object.assign(
        {},
        rootDependencies,
        ...manifests.map(getJavaScriptDependencies)
      ) as Record<string, string>;
    }

    if (rootJavaScriptLibrary) {
      return {
        library: rootJavaScriptLibrary,
        additionalModules: detectAdditionalModules(
          rootJavaScriptLibrary,
          rootPrimaryDependencies,
          includeDeclaredVue(
            aggregatePrimaryDependencies,
            aggregateDependencies
          )
        ),
      };
    }

    // Root Python projects remain authoritative over unrelated JS workspaces.
    const pythonLibrary = detectPythonLibrary(cwd);
    if (pythonLibrary) {
      return {
        library: pythonLibrary,
        additionalModules: rootPrimaryDependencies['i18next-icu']
          ? ['i18next-icu']
          : [],
      };
    }

    // Workspace discovery exists to add Vue extraction without changing the
    // CLI mode of existing file-only or React-only monorepos. A workspace
    // graph with no gt-vue declaration retains the historical root result.
    const workspaceJavaScriptLibrary = aggregateDependencies[Libraries.GT_VUE]
      ? (detectJavaScriptLibrary(aggregatePrimaryDependencies) ??
        detectDeclaredVueLibrary(aggregateDependencies))
      : undefined;
    if (workspaceJavaScriptLibrary) {
      return {
        library: workspaceJavaScriptLibrary,
        additionalModules: detectWorkspaceAdditionalModules(
          workspaceJavaScriptLibrary,
          includeDeclaredVue(
            aggregatePrimaryDependencies,
            aggregateDependencies
          )
        ),
      };
    }

    // Fallback to base if neither is found
    return { library: 'base', additionalModules: [] };
  } catch (error) {
    logger.error('Error determining framework: ' + String(error));
    return { library: 'base', additionalModules: [] };
  }
}

/** Returns the dependency fields used by framework detection before this PR. */
function getPrimaryJavaScriptDependencies(
  manifest: JavaScriptPackageManifest
): Record<string, string> {
  return {
    ...manifest.dependencies,
    ...manifest.devDependencies,
  };
}

function getJavaScriptDependencies(
  manifest: JavaScriptPackageManifest
): Record<string, string> {
  return {
    ...manifest.peerDependencies,
    ...manifest.optionalDependencies,
    ...manifest.dependencies,
    ...manifest.devDependencies,
  };
}

function detectJavaScriptLibrary(
  dependencies: Record<string, string>
): SupportedLibraries | undefined {
  return JAVASCRIPT_LIBRARY_PRIORITY.find((name) => dependencies[name]);
}

/** Allows gt-vue peer/optional declarations without widening legacy runtimes. */
function detectDeclaredVueLibrary(
  dependencies: Record<string, string>
): typeof Libraries.GT_VUE | undefined {
  return dependencies[Libraries.GT_VUE] ? Libraries.GT_VUE : undefined;
}

/** Adds only gt-vue from non-primary dependency fields. */
function includeDeclaredVue(
  primaryDependencies: Record<string, string>,
  allDependencies: Record<string, string>
): Record<string, string> {
  return allDependencies[Libraries.GT_VUE]
    ? {
        ...primaryDependencies,
        [Libraries.GT_VUE]: allDependencies[Libraries.GT_VUE],
      }
    : primaryDependencies;
}

function detectAdditionalModules(
  library: SupportedLibraries,
  primaryDependencies: Record<string, string>,
  aggregateDependencies: Record<string, string> = primaryDependencies
): SupportedLibraries[] {
  const additionalModules: SupportedLibraries[] = [];

  if (primaryDependencies['i18next-icu']) {
    additionalModules.push('i18next-icu');
  }

  // Vue is selected ahead of gt-node so Vue projects receive the
  // framework-specific CLI. Preserve the existing gt-node extraction surface
  // when both runtimes are declared by running it as an additional module.
  if (
    library !== Libraries.GT_NODE &&
    aggregateDependencies[Libraries.GT_VUE] &&
    aggregateDependencies[Libraries.GT_NODE]
  ) {
    additionalModules.push(Libraries.GT_NODE);
  }
  if (library !== Libraries.GT_VUE && aggregateDependencies[Libraries.GT_VUE]) {
    additionalModules.push(Libraries.GT_VUE);
  }

  return additionalModules;
}

/** Returns every inline runtime owned by a workspace-only aggregator. */
function detectWorkspaceAdditionalModules(
  library: SupportedLibraries,
  dependencies: Record<string, string>
): SupportedLibraries[] {
  const additionalModules = detectAdditionalModules(library, dependencies);
  for (const candidate of INLINE_JAVASCRIPT_LIBRARY_PRIORITY) {
    if (
      candidate !== library &&
      dependencies[candidate] &&
      !additionalModules.includes(candidate)
    ) {
      additionalModules.push(candidate);
    }
  }
  return additionalModules;
}
