import type {
  ChunkTranslationsState,
  InitializeConfig,
  PreloadChunk,
  Translations,
} from './state';
import { getState, getTranslatedLocale } from './state';
import { createFailedWarning } from './warnings';
import {
  addArrived,
  getFileUrl,
  register,
  request,
  requestEntry,
} from './request';
import { readCurrentMap, readCurrentNames } from './recovery';
import { gateChunk, listImportedFiles } from './gate';
import { initializeCache } from './initialize';

/**
 * `initializeChunkTranslations()` for a build that splits by module: waits
 * for the files the entry holds, which the startup script has requested, and
 * reads the locale's map when it arrives, without waiting for it.
 * @internal
 */
export function initializeRegionChunkTranslations<C extends InitializeConfig>(
  initialize: (config: C) => Promise<void>,
  config: C
): Promise<void> {
  const state = getState();
  const initialized = initializeCache(initialize, config, state);
  const locale = getTranslatedLocale();
  if (locale === undefined) return initialized;
  void requestEntry(state, locale);
  return Promise.all([
    initialized,
    ...Object.keys(state.e?.[locale] || {}).map((file) =>
      requestRegionFile(state, locale, file)
    ),
  ]).then(() => addArrived(state));
}

/**
 * `loadChunk()` for such a build: the import needs every file that holds a
 * message its modules can read. The map lists them and the hash in the name
 * of each, so they are requested once the map has arrived, but for those the
 * page holds already, and the import runs once all of them have.
 * @internal
 */
export function loadRegionChunk<T>(
  start: () => Promise<T>,
  chunk: string | 0,
  preload?: PreloadChunk<T>,
  deps?: string[],
  url?: string
): Promise<T> {
  return gateChunk(
    requestRegionFile,
    listRegionFiles,
    requestEntry,
    start,
    chunk,
    preload,
    deps,
    url
  );
}

/** `loadChunkTranslations()` for such a build. */
export function loadRegionChunkTranslations(
  files: readonly string[]
): Promise<void> | undefined {
  const locale = files.length ? getTranslatedLocale() : undefined;
  if (locale === undefined) return undefined;
  const state = getState();
  return requestEntry(state, locale)
    .then(() =>
      Promise.all(files.map((file) => requestRegionFile(state, locale, file)))
    )
    .then(() => addArrived(state));
}

/**
 * One of the files an import needs: its key and the chunk the import loads,
 * with the hash in its name when the lists of the build that is served now
 * named it (0 when the locale has no such file there) and not the page's.
 */
type RegionFile = { f: string; c?: string; h?: string | 0 };

/**
 * The files the import of a chunk needs. A chunk that the build that is
 * served now knows, once the page has read its lists, takes its files from
 * them: a file's key is of a group of messages, and a build can group them
 * differently, so a list is of one build as a whole. It names every file
 * that holds a message the chunk's modules can read, the entry's included.
 * Any other chunk keeps the list and the names of the page's own build.
 */
function listRegionFiles(
  state: ChunkTranslationsState,
  chunk: string
): RegionFile[] | undefined {
  return (
    listCurrentRegionFiles(state, chunk) ||
    listImportedFiles(state.i, chunk)?.map((f) => ({ f, c: chunk }))
  );
}

function listCurrentRegionFiles(
  state: ChunkTranslationsState,
  chunk: string
): RegionFile[] | undefined {
  const current = state.j;
  return (
    current &&
    listImportedFiles(current, chunk)?.map((f) => ({
      f,
      c: chunk,
      h: current.h?.[current.k.indexOf(f)] || 0,
    }))
  );
}

/**
 * Requests a file by its key, as the page's own build names it, or as
 * `listRegionFiles()` gives it. When the host does not have a file that the
 * import of a chunk needs, the page reads the lists of the build that is
 * served now, see `readCurrentNames()`, and requests what they list for the
 * chunk in its place.
 *
 * Imports of several chunks can wait for one file. It is requested once and
 * the lists are read once, and each import then gets its own chunk's files.
 *
 * @param isRetry Whether the file is one of those, which nothing is asked for in place of.
 */
function requestRegionFile(
  state: ChunkTranslationsState,
  locale: string,
  file: string | RegionFile,
  isRetry?: boolean
): Promise<boolean> {
  const { f, c, h }: RegionFile = typeof file === 'string' ? { f: file } : file;
  const listed = state.i;
  const own = state.e?.[locale]?.[f] || listed?.h?.[listed.k.indexOf(f)];
  const hash = h === undefined ? own : h;
  // The map lists the files that exist
  if (!hash) return Promise.resolve(true);
  // A file of another build is another file, unless it has the same name
  const key = hash === own ? `${locale} ${f}` : `${locale} ${f} ${hash}`;
  const url = getFileUrl(state, f, locale, hash);
  const requested = state.g?.[key];
  if (requested) state.g![key] = undefined;
  const read = (translations: Translations) =>
    register(state, locale, translations);
  if (c === undefined || isRetry) {
    return request(state, key, url, requested, read);
  }
  return request(state, key, url, requested, read, () => {
    const held = state.a;
    return readCurrentNames(state, locale, (name) =>
      readCurrentMap(state, locale, state.f, state.h?.[locale], name)
    ).then(() => {
      // Other lists than those that named the file stand in for it
      if (!state.j || (h !== undefined && state.a === held)) return undefined;
      (state.z ||= {})[url] = false;
      return true;
    });
  }).then((arrived) => {
    if (!arrived || state.z?.[url] !== false) return arrived;
    const files = listCurrentRegionFiles(state, c);
    // No other files: that build does not know the chunk, or names the
    // file that is gone
    if (!files || files.some((other) => other.f === f && other.h === hash)) {
      console.warn(
        createFailedWarning(
          url,
          `The build that is served now has no other file for ${c}`
        )
      );
      return false;
    }
    return Promise.all(
      files.map((other) => requestRegionFile(state, locale, other, true))
    ).then((all) => all.every(Boolean));
  });
}
