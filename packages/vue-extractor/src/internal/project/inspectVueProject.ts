import fs from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';
import type { VueProjectInspection } from '../../types.js';
import {
  discoverVueProject,
  findVueSourceScope,
  resolveProjectDirectory,
  type VueProjectDiscovery,
} from './scopes.js';
import { readJavaScriptPackageManifest } from './manifest.js';
import {
  createWorkspaceDiscoveryCache,
  readDeclaredWorkspacePackagesAsync,
} from './workspaces.js';
import { classifyVueSource } from './vueSourceClassification.js';

export { isVueSfcSource } from './vueSourceClassification.js';

const discoveryByInspection = new WeakMap<
  VueProjectInspection,
  VueProjectDiscovery
>();

/** Discovers Vue workspace ownership once and returns a reusable opaque plan. */
export function inspectVueProject(
  cwd: string = process.cwd()
): VueProjectInspection {
  return createVueProjectInspection(discoverVueProject(cwd));
}

/**
 * Discovers Vue ownership while reading declared workspace manifests with
 * bounded asynchronous I/O.
 *
 * The asynchronous traversal pre-populates the same per-inspection cache used
 * by `discoverVueProject`, preserving its ownership semantics while allowing a
 * host framework to continue its existing extraction concurrently.
 */
export async function inspectVueProjectAsync(
  cwd: string = process.cwd()
): Promise<VueProjectInspection> {
  return inspectVueProjectForRuntime(cwd, false);
}

/**
 * Inspects Vue ownership for the high-level framework planner.
 *
 * An explicitly selected `gt-vue` runtime owns its root even when a host CLI
 * supplied that selection independently of package-manifest detection. This
 * override remains package-private so ordinary discovery cannot promote a
 * React or file-only project.
 */
export async function inspectVueProjectForRuntime(
  cwd: string,
  forceRootOwnership: boolean
): Promise<VueProjectInspection> {
  const projectRoot = resolveProjectDirectory(cwd);
  const rootManifest = readJavaScriptPackageManifest(
    path.join(projectRoot, 'package.json')
  );
  const cache = createWorkspaceDiscoveryCache();
  if (rootManifest) {
    await readDeclaredWorkspacePackagesAsync(projectRoot, rootManifest, cache);
  }
  const discovery = discoverVueProject(projectRoot, cache);
  return createVueProjectInspection(
    forceRootOwnership ? addRootOwnership(discovery) : discovery
  );
}

/** Adds one forced root scope without changing discovered child scopes. */
function addRootOwnership(discovery: VueProjectDiscovery): VueProjectDiscovery {
  if (discovery.rootOwnsVue) return discovery;
  return {
    ...discovery,
    rootOwnsVue: true,
    scopes: [
      {
        directory: discovery.projectRoot,
        includeByDefault: true,
        relativeDirectory: '',
      },
      ...discovery.scopes.filter(
        ({ directory }) => directory !== discovery.projectRoot
      ),
    ],
  };
}

function createVueProjectInspection(
  discovery: VueProjectDiscovery
): VueProjectInspection {
  const inspection = Object.freeze({
    projectRoot: discovery.projectRoot,
    rootOwnsVue: discovery.rootOwnsVue,
    hasVueScopes: discovery.scopes.length > 0,
  });
  discoveryByInspection.set(inspection, discovery);
  return inspection;
}

/**
 * Returns exact negative globs for real Vue SFCs selected by explicit input.
 *
 * A `.vue` suffix alone is insufficient because the historical React parser
 * accepts arbitrary JSX modules with that extension. Only files inside a
 * discovered Vue scope whose source is classified as an SFC are partitioned.
 */
export function readVueSfcExclusionPatterns(
  inspection: VueProjectInspection,
  filePatterns: readonly string[]
): string[] {
  return partitionVueSourcePatterns(inspection, filePatterns)
    .primaryExclusionPatterns;
}

/**
 * Partitions explicitly selected `.vue` files between a historical parser and
 * the companion Vue extractor.
 *
 * A lone `<template>`, `<script>`, or `<style>` expression is valid both as a
 * Vue block and as a Babel JSX module. Those ambiguous files stay with the
 * historical parser so adding Vue support cannot remove existing messages,
 * while the companion Vue pass skips them to avoid duplicate or invalid SFC
 * diagnostics. Vue-primary and default Vue discovery do not use this explicit
 * mixed-framework partition and continue to accept template-only SFCs.
 */
export function partitionVueSourcePatterns(
  inspection: VueProjectInspection,
  filePatterns: readonly string[]
): {
  primaryExclusionPatterns: string[];
  vueExclusionPatterns: string[];
} {
  const discovery = readVueProjectInspection(
    inspection,
    inspection.projectRoot
  );
  if (!discovery) {
    return { primaryExclusionPatterns: [], vueExclusionPatterns: [] };
  }

  let matches: string[];
  try {
    matches = fg.sync([...filePatterns], {
      absolute: true,
      cwd: discovery.projectRoot,
      followSymbolicLinks: false,
      ignore: ['**/node_modules/**'],
      onlyFiles: true,
      unique: true,
    });
  } catch {
    return { primaryExclusionPatterns: [], vueExclusionPatterns: [] };
  }

  const primaryExclusionPatterns: string[] = [];
  const vueExclusionPatterns: string[] = [];
  for (const file of matches) {
    let realFile: string;
    try {
      realFile = fs.realpathSync(file);
    } catch {
      continue;
    }
    if (
      path.extname(realFile).toLowerCase() !== '.vue' ||
      !findVueSourceScope(realFile, discovery.scopes)
    ) {
      continue;
    }
    let source: string;
    try {
      source = fs.readFileSync(realFile, 'utf8');
    } catch {
      continue;
    }
    const classification = classifyVueSource(source);
    const exclusion = `!${fg.escapePath(toPosixPath(path.resolve(file)))}`;
    if (classification === 'definitive-sfc') {
      primaryExclusionPatterns.push(exclusion);
    } else if (classification === 'ambiguous-standard-tag-jsx') {
      vueExclusionPatterns.push(exclusion);
    }
  }
  return {
    primaryExclusionPatterns: [...new Set(primaryExclusionPatterns)],
    vueExclusionPatterns: [...new Set(vueExclusionPatterns)],
  };
}

/** Returns the package-private discovery carried by a valid inspection. */
export function readVueProjectInspection(
  inspection: VueProjectInspection | undefined,
  projectRoot: string
): VueProjectDiscovery | undefined {
  if (
    !inspection ||
    resolveProjectDirectory(inspection.projectRoot) !==
      resolveProjectDirectory(projectRoot)
  ) {
    return undefined;
  }
  return discoveryByInspection.get(inspection);
}

function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join(path.posix.sep);
}
