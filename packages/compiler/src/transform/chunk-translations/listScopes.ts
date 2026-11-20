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
 * them, which is what decides the file a message is in.
 *
 * A chunk lists a message with the others that the same loads fetch (a
 * region of assignTranslationsByRegion) when the chunk loads with one of
 * those loads: when an import of that load's module loads the chunk, with
 * the chunks it imports statically. In any chunk that loads later, the
 * message is listed alone.
 *
 * - A list of a chunk that loads with the load that fetches its messages
 *   changes when one of those messages comes or goes, which rewrites their
 *   file anyway.
 * - A chunk that loads later reads a few of the labels of what loaded before
 *   it: of the entry, whose file every page loads first, of a layout, of the
 *   route that opens it. A list of those would be renamed, in that file,
 *   whenever the chunk reads one label more. A list of one message is the
 *   same in every chunk that reads the message, so the file names it once.
 *
 * So a file is rewritten when the lists that name its messages change: when
 * one of its messages comes, goes or is translated anew, and when the first
 * chunk that loads later reads one of them, or the last one no longer does.
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
  const regions = listRegions(graph);
  const regionOf = new Map<string, number>();
  regions.forEach((region, index) => {
    for (const hash of region.hashes) regionOf.set(hash, index);
  });

  // The chunks an import of each module loads: those that hold the module or
  // are made for it, and every chunk they import statically
  const chunksOfModule = new Map<string, string[]>();
  for (const chunk of Object.values(chunks)) {
    const modules = new Set(Object.keys(chunk.modules));
    if (chunk.facadeModuleId) modules.add(chunk.facadeModuleId);
    for (const id of modules) {
      const holding = chunksOfModule.get(id);
      if (holding) holding.push(chunk.fileName);
      else chunksOfModule.set(id, [chunk.fileName]);
    }
  }
  const loadedWith = new Map<string, Set<string>>();
  const getLoadedWith = (load: string): Set<string> => {
    let files = loadedWith.get(load);
    if (!files) {
      files = new Set(chunksOfModule.get(load));
      for (const file of files) {
        for (const imported of chunks[file]?.imports ?? []) files.add(imported);
      }
      loadedWith.set(load, files);
    }
    return files;
  };
  return (fileName) => {
    const listsTogether = new Map<number, boolean>();
    return (hash) => {
      const region = regionOf.get(hash);
      if (region === undefined) return undefined;
      let together = listsTogether.get(region);
      if (together === undefined) {
        together = regions[region].loads.some((load) =>
          getLoadedWith(load).has(fileName)
        );
        listsTogether.set(region, together);
      }
      return together ? region : hash;
    };
  };
}
