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

const JAVASCRIPT_LIBRARY_PRIORITY = [
  Libraries.GT_NEXT,
  Libraries.GT_TANSTACK_START,
  Libraries.GT_REACT,
  Libraries.GT_REACT_NATIVE,
  Libraries.GT_VUE,
  Libraries.GT_NODE,
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
    let rootJavaScriptLibrary: SupportedLibraries | undefined;
    let aggregateDependencies: Record<string, string> = {};

    // Check if package.json exists
    if (fs.existsSync(packageJsonPath)) {
      // Read and parse package.json
      const packageJson = JSON.parse(
        fs.readFileSync(packageJsonPath, 'utf8')
      ) as JavaScriptPackageManifest;
      rootDependencies = getJavaScriptDependencies(packageJson);
      const manifests = readDeclaredWorkspaceManifests(cwd, packageJson);
      aggregateDependencies = Object.assign(
        {},
        rootDependencies,
        ...manifests.map(getJavaScriptDependencies)
      ) as Record<string, string>;
      rootJavaScriptLibrary = detectJavaScriptLibrary(rootDependencies);
    }

    if (rootJavaScriptLibrary) {
      return {
        library: rootJavaScriptLibrary,
        additionalModules: detectAdditionalModules(
          rootJavaScriptLibrary,
          aggregateDependencies
        ),
      };
    }

    // Root Python projects remain authoritative over unrelated JS workspaces.
    const pythonLibrary = detectPythonLibrary(cwd);
    if (pythonLibrary) {
      return {
        library: pythonLibrary,
        additionalModules: rootDependencies['i18next-icu']
          ? ['i18next-icu']
          : [],
      };
    }

    const workspaceJavaScriptLibrary = detectJavaScriptLibrary(
      aggregateDependencies
    );
    if (workspaceJavaScriptLibrary) {
      return {
        library: workspaceJavaScriptLibrary,
        additionalModules: detectAdditionalModules(
          workspaceJavaScriptLibrary,
          aggregateDependencies
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

function detectAdditionalModules(
  library: SupportedLibraries,
  dependencies: Record<string, string>
): SupportedLibraries[] {
  const additionalModules: SupportedLibraries[] = [];

  if (dependencies['i18next-icu']) {
    additionalModules.push('i18next-icu');
  }

  // Vue is selected ahead of gt-node so Vue projects receive the
  // framework-specific CLI. Preserve the existing gt-node extraction surface
  // when both runtimes are declared by running it as an additional module.
  if (
    library !== Libraries.GT_NODE &&
    dependencies[Libraries.GT_VUE] &&
    dependencies[Libraries.GT_NODE]
  ) {
    additionalModules.push(Libraries.GT_NODE);
  }
  if (library !== Libraries.GT_VUE && dependencies[Libraries.GT_VUE]) {
    additionalModules.push(Libraries.GT_VUE);
  }

  return additionalModules;
}
