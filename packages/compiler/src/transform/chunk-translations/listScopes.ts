import { listRegions } from './assignTranslationsByRegion';
import {
  createRegionGraph,
  type RegionChunk,
  type RegionModuleInfo,
} from './createRegionGraph';
import { readPlaceholders, type MinifiedIds } from './hashMinification';

/** A chunk as the bundler passes it to every `renderChunk` of one render, before it has a name. */
export type RenderedRegionChunk = Omit<RegionChunk, 'code'>;

/**
 * What says which of a chunk's messages share a list, for `minifyChunk`, in
 * a build that splits by module with hash minification.
 *
 * An id names a list, and a file names the list of every id it holds. With
 * one list per chunk, a message added anywhere in a chunk renames that
 * list, and with it every file the chunk reads a message from: the file
 * every page loads first holds a message of most chunks, so most deploys
 * rewrite it. So a chunk's messages are listed by the loads that fetch
 * them, which is what decides the file a message is in: a list then changes
 * only with the messages of its own file.
 *
 * - Messages of a chunk are listed together when the same loads fetch them
 *   (a region of assignTranslationsByRegion).
 * - A message that an entry fetches is listed alone in a chunk that does
 *   not load with an entry. Every such chunk reads a few of the labels a
 *   whole app repeats, and a list of them would be renamed, in the file
 *   every page loads first, whenever the chunk reads one more. A list of one
 *   message is the same in every chunk that reads it.
 *
 * The regions are read from the code of the modules as the bundler rendered
 * them, before any chunk is minified, and the files are assigned from the
 * same code afterwards: a call site that the minifier removes still fetches
 * its message there while another chunk reads it (see createRegionGraph), so
 * the messages of a list stay in one file.
 */
export function findListScopes(
  chunks: Record<string, RenderedRegionChunk>,
  getModuleInfo: (id: string) => RegionModuleInfo | null,
  hashes: ReadonlySet<string>,
  minified: MinifiedIds,
  isLazy: boolean
): (fileName: string) => (hash: string) => number | string | undefined {
  const placeholders = readPlaceholders(minified);
  const { graph } = createRegionGraph(
    Object.values(chunks).map((chunk) => ({
      fileName: chunk.fileName,
      code: Object.values(chunk.modules)
        .map((module) => module.code ?? '')
        .join('\n'),
      isEntry: chunk.isEntry,
      facadeModuleId: chunk.facadeModuleId,
      imports: chunk.imports,
      dynamicImports: chunk.dynamicImports,
      modules: chunk.modules,
    })),
    getModuleInfo,
    hashes,
    { isLazy, ids: placeholders, moduleIds: placeholders }
  );
  const entries = new Set(graph.entries);
  const regionOf = new Map<string, number>();
  const fetchedByEntries = new Set<string>();
  listRegions(graph).forEach((region, index) => {
    const isOfEntries = region.loads.every((load) => entries.has(load));
    for (const hash of region.hashes) {
      regionOf.set(hash, index);
      if (isOfEntries) fetchedByEntries.add(hash);
    }
  });

  const loadedWithEntries = new Set(
    Object.values(chunks).flatMap((chunk) =>
      chunk.isEntry ? [chunk.fileName] : []
    )
  );
  for (const file of loadedWithEntries) {
    for (const imported of chunks[file]?.imports ?? []) {
      loadedWithEntries.add(imported);
    }
  }
  return (fileName) => {
    const loadsWithEntries = loadedWithEntries.has(fileName);
    return (hash) =>
      !loadsWithEntries && fetchedByEntries.has(hash)
        ? hash
        : regionOf.get(hash);
  };
}
