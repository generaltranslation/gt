import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { findChunkHashes } from './assignTranslations';
import type { MinifiedIdReader } from './hashMinification';
import type { RegionGraph, RegionModule } from './assignTranslationsByRegion';

/** A chunk of the bundle, as Rollup, Rolldown and Vite pass it to `generateBundle`. */
export type RegionChunk = {
  fileName: string;
  /** The chunk's final code */
  code: string;
  isEntry: boolean;
  facadeModuleId: string | null;
  /** The files of the chunks it imports statically */
  imports: readonly string[];
  /** The files of the chunks it imports dynamically */
  dynamicImports?: readonly string[];
  /** The rendered code of each of its modules, before the chunk is minified */
  modules: Record<string, { code: string | null }>;
};

// How many characters of a pair name the module that reads its message
const PAIR_MODULE_LENGTH = 8;

const NODE_MODULES = '/node_modules/';

/**
 * What names, in a pair, the module that reads the message, see
 * createRegionGraph: the start of a digest of the module's id, written so
 * that it does not depend on where the build runs or on where its
 * dependencies are stored.
 *
 * - A module of a package is named from the last `node_modules/` of its id:
 *   the package and the path inside it, whichever store holds the package.
 * - Any other module is named by its path below the last directory it has in
 *   common with `root`, the directory the build's modules are in: the path
 *   from `root` for a module inside it, and for one outside it that path
 *   without the steps that lead out.
 * - An id that is no path, as a virtual module's, is named as it is.
 *
 * Two modules can get one name: two versions of a package, or two digests
 * that start alike. What reads the same message from both is then one pair,
 * see createRegionGraph.
 */
export function getPairModule(id: string, root: string): string {
  // A plugin's module of a file starts with a null character
  const written = (id.startsWith('\0') ? id.slice(1) : id).replace(/\\/g, '/');
  const packaged = written.lastIndexOf(NODE_MODULES);
  let named = written.slice(packaged + NODE_MODULES.length);
  if (packaged === -1) {
    const from = root.replace(/\\/g, '/').replace(/\/$/, '').split('/');
    const to = written.split('/');
    let shared = 0;
    while (
      shared < from.length &&
      shared < to.length - 1 &&
      from[shared] === to[shared]
    ) {
      shared++;
    }
    named = to.slice(shared).join('/');
  }
  return createHash('sha256')
    .update(named)
    .digest('hex')
    .slice(0, PAIR_MODULE_LENGTH);
}

/** A message and a chunk that reads it, see createRegionGraph: the hash, then what getPairModule names the first module of the chunk that reads it. */
export const getPairKey = (hash: string, module: string) => `${hash}${module}`;

/** What `this.getModuleInfo(id)` returns of a module. */
export type RegionModuleInfo = {
  importedIds: readonly string[];
  dynamicallyImportedIds: readonly string[];
};

/**
 * Whether the build runs the body of a module only when the module is first
 * imported, from the output and input options a plugin's `outputOptions` and
 * `options` hooks receive. `generateBundle` gets normalized options, which do
 * not say.
 *
 * Rolldown does so under `output.strictExecutionOrder`, which wraps every
 * module in a function. An inlining of common chunks turns the option on when
 * it is left out, and `experimental.onDemandWrapping` leaves some modules
 * unwrapped. Rollup has no such option: a chunk runs all of its modules.
 */
export function initialisesModulesLazily(
  output: {
    strictExecutionOrder?: boolean;
    codeSplitting?:
      | boolean
      | { experimentalInlineCommonChunks?: { maxSize?: number } };
  },
  input: { experimental?: { onDemandWrapping?: boolean } } = {}
): boolean {
  if (input.experimental?.onDemandWrapping) return false;
  if (output.strictExecutionOrder !== undefined) {
    return output.strictExecutionOrder;
  }
  const inlined =
    typeof output.codeSplitting === 'object'
      ? output.codeSplitting.experimentalInlineCommonChunks?.maxSize
      : undefined;
  return inlined !== undefined && inlined > 0;
}

/**
 * The module graph of a build, for assignTranslationsByRegion.
 *
 * - The modules are those of every chunk and those they import, also the
 *   ones the bundler left no code of: a module that only re-exports still
 *   leads to what it imports.
 * - A module's messages are the hashes in its rendered code that are also in
 *   the final code of its chunk, see findChunkHashes, so a call site that
 *   tree-shaking or the minifier removed counts for nothing. A hash that is
 *   in a chunk's code and in none of its modules' is given to all of them;
 *   `unattributed` counts those.
 * - The entries are the modules the entry chunks are made for.
 * - A dynamic import of a module in the chunk of the module that imports it
 *   is one of that module's `imports`, unless that chunk imports another
 *   that is made for the imported module. The bundler writes it without an
 *   `import()`, so it loads nothing and nothing can wait for files there:
 *   the load that brought the importing module holds its messages.
 *
 * With `isLazy` false, a chunk runs all of its modules when it loads. Each
 * load point then gets, in `evaluated`, the modules of the chunks that hold
 * its module and of every chunk those import statically, and each module its
 * `initialHashes`: those `initialHashes` names for it, or all of its
 * messages when nothing says which of its call sites run that early.
 *
 * With `pairs`, the graph holds a message once for each chunk that reads it:
 * a module's `hashes` are pairs of a message and the module's chunk, and
 * `pairs` returns the hash of each and the pair of each message a chunk
 * reads. A load then demands a pair when it reaches a module of that chunk
 * that reads the message, so a chunk that reads what an earlier load holds
 * for another chunk has its own copy fetched by its own loads, and the file
 * of the earlier load holds nothing for it.
 *
 * A pair is named by its hash and by the first, in the order of their ids,
 * of the chunk's modules that read the message, see getPairKey. So it keeps
 * its name, and with `previous` its file, while that module reads the
 * message there, whatever else the chunk comes to hold. A bundler puts a
 * module in one chunk, and then no two chunks share a pair. Where it does
 * not, the chunks that hold the module share the pairs of what it reads
 * first: one pair for all of them, which every load that reaches the module
 * fetches, and whose file holds the ids of each chunk.
 */
export function createRegionGraph(
  chunks: readonly RegionChunk[],
  getModuleInfo: (id: string) => RegionModuleInfo | null,
  hashes: ReadonlySet<string>,
  options: {
    isLazy: boolean;
    /** The hashes of the call sites each module runs when it is initialised */
    initialHashes?: ReadonlyMap<string, readonly string[]>;
    /** Set in a build with hash minification, whose call sites pass ids */
    ids?: MinifiedIdReader;
    /**
     * Set in such a build too: the code of a module holds placeholders, and
     * not the ids of its chunk's final code
     */
    moduleIds?: MinifiedIdReader;
    /**
     * Set to count a message once for each chunk that reads it. `root` is
     * the directory the build's modules are in, see getPairModule.
     */
    pairs?: { root: string };
  }
): {
  graph: RegionGraph;
  unattributed: number;
  /** With `pairs` */
  pairs?: {
    /** The hash of the message of each pair */
    hashes: Map<string, string>;
    /** The pair of each message a chunk reads, by the chunk's file and the hash */
    byChunk: Map<string, Map<string, string>>;
  };
} {
  const pairs = options.pairs && {
    hashes: new Map<string, string>(),
    byChunk: new Map<string, Map<string, string>>(),
  };
  const moduleHashes = new Map<string, Set<string>>();
  const chunksOfModule = new Map<string, RegionChunk[]>();
  let unattributed = 0;
  for (const chunk of chunks) {
    const surviving = new Set(findChunkHashes(chunk.code, hashes, options.ids));
    const found = new Set<string>();
    const ids = Object.keys(chunk.modules);
    // Each message a module of the chunk reads
    const read: [id: string, hash: string][] = [];
    for (const id of ids) {
      if (!moduleHashes.has(id)) moduleHashes.set(id, new Set());
      const holding = chunksOfModule.get(id);
      if (holding) holding.push(chunk);
      else chunksOfModule.set(id, [chunk]);
      const { code } = chunk.modules[id];
      if (!code) continue;
      for (const hash of findChunkHashes(
        code,
        surviving,
        options.moduleIds ?? options.ids
      )) {
        read.push([id, hash]);
        found.add(hash);
      }
    }
    for (const hash of surviving) {
      if (found.has(hash)) continue;
      unattributed++;
      for (const id of ids) read.push([id, hash]);
    }
    if (!pairs) {
      for (const [id, hash] of read) moduleHashes.get(id)!.add(hash);
      continue;
    }
    const first = new Map<string, string>();
    for (const [id, hash] of read) {
      const reader = first.get(hash);
      if (reader === undefined || id < reader) first.set(hash, id);
    }
    const ofChunk = new Map<string, string>();
    for (const [hash, id] of first) {
      const pair = getPairKey(hash, getPairModule(id, options.pairs!.root));
      ofChunk.set(hash, pair);
      pairs.hashes.set(pair, hash);
    }
    pairs.byChunk.set(chunk.fileName, ofChunk);
    for (const [id, hash] of read)
      moduleHashes.get(id)!.add(ofChunk.get(hash)!);
  }

  // The module each chunk that holds none of its own is made for: an import
  // of the module loads that chunk, which passes on the module's exports
  const madeFor = new Map(
    chunks.flatMap((chunk) =>
      chunk.facadeModuleId && !(chunk.facadeModuleId in chunk.modules)
        ? [[chunk.fileName, chunk.facadeModuleId] as const]
        : []
    )
  );
  const isInlined = (id: string, importer: string) => {
    const holding = chunksOfModule.get(importer);
    const chunksOfId = chunksOfModule.get(id);
    return (
      !!holding &&
      !!chunksOfId &&
      holding.every(
        (chunk) =>
          chunksOfId.includes(chunk) &&
          !chunk.dynamicImports?.some((file) => madeFor.get(file) === id)
      )
    );
  };

  const modules: RegionModule[] = [];
  const dynamicTargets = new Set<string>();
  const seen = new Set(moduleHashes.keys());
  const pending = [...seen];
  for (let id = pending.pop(); id !== undefined; id = pending.pop()) {
    const info = getModuleInfo(id);
    const imports = new Set(info?.importedIds);
    const dynamicImports: string[] = [];
    for (const next of info?.dynamicallyImportedIds ?? []) {
      if (isInlined(next, id)) imports.add(next);
      else dynamicImports.push(next);
    }
    const held = [...(moduleHashes.get(id) ?? [])].sort();
    const initial =
      pairs && options.initialHashes && new Set(options.initialHashes.get(id));
    modules.push({
      id,
      hashes: held,
      imports: [...imports],
      dynamicImports,
      ...(!options.isLazy && {
        initialHashes: initial
          ? held.filter((pair) => initial.has(pairs!.hashes.get(pair)!))
          : options.initialHashes
            ? (options.initialHashes.get(id) ?? []).filter((hash) =>
                moduleHashes.get(id)?.has(hash)
              )
            : held,
      }),
    });
    for (const next of dynamicImports) dynamicTargets.add(next);
    for (const next of [...imports, ...dynamicImports]) {
      if (seen.has(next)) continue;
      seen.add(next);
      pending.push(next);
    }
  }
  modules.sort((a, b) => (a.id < b.id ? -1 : 1));

  const entries = [
    ...new Set(
      chunks.flatMap((chunk) =>
        chunk.isEntry && chunk.facadeModuleId ? [chunk.facadeModuleId] : []
      )
    ),
  ];
  if (options.isLazy) {
    return {
      graph: { modules, entries },
      unattributed,
      ...(pairs && { pairs }),
    };
  }

  // What runs with a chunk: its modules that run a call site when they are
  // initialised, and those of the chunks it imports statically
  const byFile = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
  const initialising = new Set(
    modules.flatMap((module) => (module.initialHashes?.length ? module.id : []))
  );
  const evaluatedWith = new Map<string, string[]>();
  const getEvaluated = (start: RegionChunk): string[] => {
    let evaluated = evaluatedWith.get(start.fileName);
    if (!evaluated) {
      const ids = new Set<string>();
      const reached = new Set([start]);
      for (const chunk of reached) {
        for (const id of Object.keys(chunk.modules)) {
          if (initialising.has(id)) ids.add(id);
        }
        for (const file of chunk.imports) {
          const imported = byFile.get(file);
          if (imported) reached.add(imported);
        }
      }
      evaluated = [...ids];
      evaluatedWith.set(start.fileName, evaluated);
    }
    return evaluated;
  };
  const evaluated = new Map<string, string[]>();
  for (const id of [...entries, ...dynamicTargets]) {
    const holding = chunksOfModule.get(id) ?? [];
    evaluated.set(
      id,
      holding.length === 1
        ? getEvaluated(holding[0])
        : [...new Set(holding.flatMap(getEvaluated))]
    );
  }
  return {
    graph: { modules, entries, evaluated },
    unattributed,
    ...(pairs && { pairs }),
  };
}

// Files of 1 to 1,024 messages
const SAMPLE_SIZES = 11;
const SAMPLES_PER_SIZE = 12;

/**
 * What files of a locale's translations compress to, for fitCompressedSize:
 * files of 1, 2, 4 and up to 1,024 messages, taken at even steps through the
 * hashes in their order. `bytes` is the sum of the messages' `sizes`, which
 * assignTranslationsByRegion adds up the same way.
 */
export function sampleCompressedSizes(
  translations: Record<string, unknown>,
  sizes: ReadonlyMap<string, number>
): { bytes: number; compressed: number }[] {
  const hashes = Object.keys(translations)
    .filter((hash) => translations[hash] != null)
    .sort();
  const samples: { bytes: number; compressed: number }[] = [];
  for (let size = 0; size < SAMPLE_SIZES; size++) {
    const length = 2 ** size;
    if (length > hashes.length) break;
    const starts = Math.min(
      SAMPLES_PER_SIZE,
      Math.floor(hashes.length / length)
    );
    for (let sample = 0; sample < starts; sample++) {
      const start = Math.floor(
        (sample * (hashes.length - length)) / Math.max(1, starts - 1)
      );
      const picked: Record<string, unknown> = {};
      let bytes = 0;
      for (const hash of hashes.slice(start, start + length)) {
        picked[hash] = translations[hash];
        bytes += sizes.get(hash) ?? 0;
      }
      samples.push({
        bytes,
        compressed: gzipSync(JSON.stringify(picked)).length,
      });
    }
  }
  return samples;
}

/**
 * One size for each message, for assignTranslationsByRegion: the mean bytes
 * of its entry in a locale's translations file, over the locales that
 * translate it.
 */
export function getMessageSizes(
  translations: Record<string, Record<string, unknown> | undefined>,
  hashes: Iterable<string>
): Map<string, number> {
  const tables = Object.values(translations).filter((table) => table);
  const sizes = new Map<string, number>();
  for (const hash of hashes) {
    let bytes = 0;
    let count = 0;
    for (const table of tables) {
      const translation = table![hash];
      if (translation == null) continue;
      // The key in quotes, a colon, the value and a comma
      bytes += Buffer.byteLength(JSON.stringify(translation)) + hash.length + 4;
      count++;
    }
    sizes.set(hash, count ? Math.round(bytes / count) : 0);
  }
  return sizes;
}
