/**
 * What a build made with the compiler's experimental
 * `experimentalSplitTranslations` option loads its translations with. Such a
 * build writes translations into small JSON files per locale next to its
 * JavaScript chunks, so a page downloads only the translations of the code it
 * loads, in its own locale. Compiled code imports this entry; it is not
 * written by hand.
 *
 * - The entry chunk and what it imports statically share one file per locale.
 *   The page's startup script (see the compiler's `startupScript.ts`)
 *   requests it while the HTML is parsed, and `initializeChunkTranslations()`
 *   waits for it.
 * - `loadChunk()` wraps each dynamic import: it requests the files the import
 *   needs while the chunks download, and runs the `import()` once the files
 *   have arrived, so a chunk's modules never run before their translations.
 *   Which files an import needs is in the entry's file, so no page downloads
 *   those lists with its JavaScript. A file's URL is its key, the locale and
 *   the locale's token, which the startup script holds, so the script can
 *   request the files of chunks the page preloads before any module runs;
 *   those requests are read here, not made again. A build can instead name
 *   each file by the hash of what it holds alone (the compiler's `map`
 *   naming): one more file per locale, the map, then says which file is each
 *   chunk's and which files an import needs. See `loadMappedChunk()`.
 * - The translations of the files a load needs are added to gt-react's
 *   translations cache, in one call, when the load's import runs, where `<T>`,
 *   `t` and every other API look them up by hash. Files that arrive before the
 *   cache has loaded the locale are given to that load instead, and the cache
 *   keeps the locale for good: the files a build wrote do not change.
 *
 * Which messages a file holds is the compiler's choice: this entry only loads
 * files by the keys it is given. A build that splits by module (the
 * compiler's `experimentalSplitTranslations` with `by: 'module'`) has files that
 * hold the messages of modules from many chunks: an import needs several, the
 * entry holds several, and the file the startup script requests first is the
 * locale's map, which lists them. See `loadRegionChunk()`.
 *
 * A file that fails to load, or takes longer than the timeout, is reported
 * with a warning and its messages render their source. A late file is still
 * read when it arrives: mounted `<T>` components and the functions of
 * `useGT()` and `useMessages()` then render its translations, and a string
 * the exported `t` returned stays as it is. Once the wait for a file has run
 * out, no import waits for a file until one has arrived in time, so on a
 * host that is slow, imports that start one another cost a page one wait:
 * see `getWait()`.
 *
 * A page that stays open while the app is deployed again asks for files by
 * the names its own build gave them, which a host may no longer have. See
 * `readCurrentNames()` for what it then asks for in their place.
 *
 * Nothing here runs when a module loads, and all state is on one global
 * object, which the startup script creates before any module runs.
 *
 * A build with the compiler's hash minification imports what it loads and
 * starts with by a second name, `loadMinifiedChunk()` for `loadChunk()` and
 * so on: a gt-react that does not read the files of such a build has no such
 * export, so the bundler fails on it.
 */
export type { ChunkTranslationsState } from './chunk-translations/state';
export {
  loadChunk,
  loadChunk as loadMinifiedChunk,
} from './chunk-translations/gate';
export { loadChunkTranslations } from './chunk-translations/token';
export {
  initializeChunkTranslations,
  initializeChunkTranslations as initializeMinifiedChunkTranslations,
} from './chunk-translations/initialize';
export {
  initializeMappedChunkTranslations,
  initializeMappedChunkTranslations as initializeMinifiedMappedChunkTranslations,
  loadMappedChunk,
  loadMappedChunk as loadMinifiedMappedChunk,
  loadMappedChunkTranslations,
} from './chunk-translations/map';
export {
  initializeRegionChunkTranslations,
  initializeRegionChunkTranslations as initializeMinifiedRegionChunkTranslations,
  loadRegionChunk,
  loadRegionChunk as loadMinifiedRegionChunk,
  loadRegionChunkTranslations,
} from './chunk-translations/region';
