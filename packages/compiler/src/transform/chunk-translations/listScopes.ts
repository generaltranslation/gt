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
 * An id names a list, and a file names the list of every id it holds. A
 * chunk's messages are in the files of the loads that reach their call
 * sites in the chunk, which can be several: a shared chunk holds what the
 * entry reaches next to what only a route does. With one list for the
 * chunk, a message added to the route's part would rename that list in the
 * entry's file too. So a chunk has a list for each set of its messages that
 * the same loads fetch (a region of assignTranslationsByRegion, of pairs):
 * every list is wholly in one file, and a file is rewritten only when one
 * of its own messages comes, goes or is translated anew. Regions merge into
 * files afterwards, so a file can hold several lists of one chunk.
 *
 * What this costs: a chunk's lists, and so its ids and the name the bundler
 * gives it, follow from the loads of the whole app and not from the chunk
 * alone. When another load comes to fetch some of the messages of a list,
 * as a new route does that imports one module of a shared chunk, or stops,
 * the chunk is listed anew although it reads what it read.
 *
 * The regions are read from the code of the modules as the bundler rendered
 * them, before any chunk is minified. A call site that the minifier then
 * removes takes its id out of its list and moves no other: what fetches a
 * chunk's message follows from the modules of that chunk alone.
 *
 * Returns, by the file of a chunk and then by a hash, a value that two of
 * the chunk's messages share when they are listed together. Undefined for a
 * message the chunk does not read.
 */
export function findListScopes(
  chunks: Record<string, RenderedRegionChunk>,
  getModuleInfo: (id: string) => RegionModuleInfo | null,
  hashes: ReadonlySet<string>,
  minified: MinifiedIds,
  { isLazy, root }: { isLazy: boolean; root: string }
): (fileName: string) => (hash: string) => number | undefined {
  const placeholders = readPlaceholders(minified);
  const { graph, pairs } = createRegionGraph(
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
    { isLazy, ids: placeholders, moduleIds: placeholders, pairs: { root } }
  );
  const regionOf = new Map<string, number>();
  listRegions(graph).forEach((region, index) => {
    for (const pair of region.hashes) regionOf.set(pair, index);
  });
  return (fileName) => {
    const ofChunk = pairs?.byChunk.get(fileName);
    return (hash) => {
      const pair = ofChunk?.get(hash);
      return pair === undefined ? undefined : regionOf.get(pair);
    };
  };
}
