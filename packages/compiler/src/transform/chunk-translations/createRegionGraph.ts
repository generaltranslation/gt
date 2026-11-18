import { gzipSync } from 'node:zlib';
import { findChunkHashes } from './assignTranslations';
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
  /** The rendered code of each of its modules, before the chunk is minified */
  modules: Record<string, { code: string | null }>;
};

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
 *
 * With `isLazy` false, a chunk runs all of its modules when it loads. Each
 * load point then gets, in `evaluated`, the modules of the chunks that hold
 * its module and of every chunk those import statically, and each module its
 * `initialHashes`: those `initialHashes` names for it, or all of its
 * messages when nothing says which of its call sites run that early.
 */
export function createRegionGraph(
  chunks: readonly RegionChunk[],
  getModuleInfo: (id: string) => RegionModuleInfo | null,
  hashes: ReadonlySet<string>,
  options: {
    isLazy: boolean;
    /** The hashes of the call sites each module runs when it is initialised */
    initialHashes?: ReadonlyMap<string, readonly string[]>;
  }
): { graph: RegionGraph; unattributed: number } {
  const moduleHashes = new Map<string, Set<string>>();
  const chunksOfModule = new Map<string, RegionChunk[]>();
  let unattributed = 0;
  for (const chunk of chunks) {
    const surviving = new Set(findChunkHashes(chunk.code, hashes));
    const found = new Set<string>();
    const ids = Object.keys(chunk.modules);
    for (const id of ids) {
      let held = moduleHashes.get(id);
      if (!held) moduleHashes.set(id, (held = new Set()));
      const holding = chunksOfModule.get(id);
      if (holding) holding.push(chunk);
      else chunksOfModule.set(id, [chunk]);
      const { code } = chunk.modules[id];
      if (!code) continue;
      for (const hash of findChunkHashes(code, surviving)) {
        held.add(hash);
        found.add(hash);
      }
    }
    for (const hash of surviving) {
      if (found.has(hash)) continue;
      unattributed++;
      for (const id of ids) moduleHashes.get(id)!.add(hash);
    }
  }

  const modules: RegionModule[] = [];
  const dynamicTargets = new Set<string>();
  const seen = new Set(moduleHashes.keys());
  const pending = [...seen];
  for (let id = pending.pop(); id !== undefined; id = pending.pop()) {
    const info = getModuleInfo(id);
    const imports = [...(info?.importedIds ?? [])];
    const dynamicImports = [...(info?.dynamicallyImportedIds ?? [])];
    const held = [...(moduleHashes.get(id) ?? [])].sort();
    modules.push({
      id,
      hashes: held,
      imports,
      dynamicImports,
      ...(!options.isLazy && {
        initialHashes: options.initialHashes
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
  if (options.isLazy) return { graph: { modules, entries }, unattributed };

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
  return { graph: { modules, entries, evaluated }, unattributed };
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
