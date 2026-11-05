/**
 * Default vendor chunking for locale twins. Twinning spreads from translated
 * chunks to every chunk that references them, so library code bundled into
 * the entry chunk would be copied once per locale. A vendor chunk keeps it
 * shared.
 *
 * A library module that imports app code (for example a framework's client
 * entry importing the router) must stay out of the vendor chunk: both Rolldown
 * groups and Rollup manual chunks pull the dependencies of captured modules
 * into the chunk, which would move translated app modules into it. When that
 * module is the build's entry (TanStack Start's client entry), the entry and
 * the whole app would move along, leaving no separate vendor chunk at all.
 */
import path from 'node:path';

const NODE_MODULES_PATTERN = /[\\/]node_modules[\\/]/;

export const VENDOR_CHUNK_NAME = 'vendor';

/** The parts of a Rollup/Rolldown plugin context used to read the module graph. */
export type ModuleGraph = {
  getModuleIds(): Iterable<string>;
  getModuleInfo(
    id: string
  ): { readonly importedIds: readonly string[] } | null | undefined;
};

type ModuleKind = 'library' | 'app' | 'other';

function stripQuery(id: string): string {
  const index = id.indexOf('?');
  return index === -1 ? id : id.slice(0, index);
}

/**
 * Library code is anything in `node_modules` or outside the project root
 * (e.g. linked workspace packages). App code is a file under the root.
 * Virtual modules are neither.
 */
function moduleKind(id: string, root: string): ModuleKind {
  if (id.startsWith('\0')) return 'other';
  const file = stripQuery(id);
  if (NODE_MODULES_PATTERN.test(file)) return 'library';
  if (!path.isAbsolute(file)) return 'other';
  const relative = path.relative(root, file);
  const outside = relative.startsWith('..') || path.isAbsolute(relative);
  return outside ? 'library' : 'app';
}

/**
 * Returns the ids of modules that statically import app code, directly or
 * through other modules.
 */
export function findAppImporters(
  graph: ModuleGraph,
  root: string
): Set<string> {
  const importers = new Map<string, string[]>();
  const appModules: string[] = [];
  for (const id of graph.getModuleIds()) {
    if (moduleKind(id, root) === 'app') appModules.push(id);
    for (const imported of graph.getModuleInfo(id)?.importedIds ?? []) {
      const list = importers.get(imported);
      if (list) list.push(id);
      else importers.set(imported, [id]);
    }
  }
  const reached = new Set<string>();
  const queue = [...appModules];
  while (queue.length > 0) {
    const id = queue.pop()!;
    for (const importer of importers.get(id) ?? []) {
      if (reached.has(importer)) continue;
      reached.add(importer);
      queue.push(importer);
    }
  }
  return reached;
}

/**
 * Decides vendor chunk membership for one client build. Call `record` from
 * `buildEnd` (the graph is complete, chunking has not started) on the plugin
 * instance that builds. Until then nothing is vendor: without the graph, a
 * library module that imports the app cannot be told apart.
 */
export class VendorChunkSelector {
  private graph: { root: string; appImporters: Set<string> } | undefined;

  record(graph: ModuleGraph, root: string): void {
    this.graph = { root, appImporters: findAppImporters(graph, root) };
  }

  isVendor = (id: string): boolean =>
    this.graph !== undefined &&
    moduleKind(id, this.graph.root) === 'library' &&
    !this.graph.appImporters.has(id);
}

const CHUNKING_OPTIONS = [
  'codeSplitting',
  'advancedChunks',
  'manualChunks',
  'inlineDynamicImports',
  // Rollup rejects manualChunks with preserveModules
  'preserveModules',
] as const;

type BuildOptionsLike =
  | {
      rollupOptions?: { output?: unknown };
      rolldownOptions?: { output?: unknown };
    }
  | undefined;

/**
 * Returns the user's chunking option (as a config path) if one is set, so
 * the default vendor chunk does not override it.
 */
export function findUserChunking(build: BuildOptionsLike): string | undefined {
  for (const key of ['rolldownOptions', 'rollupOptions'] as const) {
    const output = build?.[key]?.output;
    if (output === undefined || output === null) continue;
    if (Array.isArray(output)) return `build.${key}.output (several outputs)`;
    if (typeof output !== 'object') continue;
    for (const option of CHUNKING_OPTIONS) {
      if ((output as Record<string, unknown>)[option] !== undefined) {
        return `build.${key}.output.${option}`;
      }
    }
  }
  return undefined;
}

/** Vendor chunking for Rolldown (Vite 8) or Rollup (Vite 7). */
export type VendorChunkOutputOptions =
  | {
      codeSplitting: {
        groups: { name: string; test: (id: string) => boolean }[];
      };
    }
  | { manualChunks: (id: string) => string | undefined };

/**
 * The output options that add the vendor chunk: a Rolldown code splitting
 * group on Vite 8, `manualChunks` on Vite 7 (Rollup). They are added in the
 * `outputOptions` hook, not to the environment config, because the config can
 * be resolved by other plugin instances than the one that builds (TanStack
 * Start resolves it once more per environment and builds with the first
 * instances), and only the building instance sees the module graph.
 */
export function createVendorChunkOutputOptions(
  isVendor: (id: string) => boolean,
  rolldown: boolean
): VendorChunkOutputOptions {
  if (rolldown) {
    return {
      codeSplitting: {
        groups: [{ name: VENDOR_CHUNK_NAME, test: isVendor }],
      },
    };
  }
  return {
    manualChunks: (id: string) =>
      isVendor(id) ? VENDOR_CHUNK_NAME : undefined,
  };
}
