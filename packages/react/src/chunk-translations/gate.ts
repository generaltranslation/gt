import type {
  ChunkTranslationsState,
  ImportedFiles,
  PreloadChunk,
} from './state';
import { getState, getTranslatedLocale } from './state';
import { createUnlistedChunkWarning } from './warnings';
import { addArrived, requestEntry } from './request';
import { requestFile } from './token';

/**
 * Runs a dynamic import once the translation files it needs have arrived, so
 * no module of its chunks runs before them. The files are requested while the
 * chunks download: `preload` adds its links at once, and only the `import()`
 * waits. In a locale that renders the source this is `preload(start, deps,
 * url)`, the call the bundler wrote.
 * @param start Calls `import()`.
 * @param chunk The file of the imported chunk, or 0 when it is the first of `deps`.
 * @param preload Vite's preload call for the import, with its arguments after it.
 * @internal
 */
export function loadChunk<T>(
  start: () => Promise<T>,
  chunk: string | 0,
  preload?: PreloadChunk<T>,
  deps?: string[],
  url?: string
): Promise<T> {
  return gateChunk(
    requestFile,
    listFiles,
    requestEntry,
    start,
    chunk,
    preload,
    deps,
    url
  );
}

/** The files the import of a chunk needs, as the page's own lists have them. */
export function listFiles(
  state: ChunkTranslationsState,
  chunk: string
): string[] | undefined {
  return listImportedFiles(state.i, chunk);
}

/**
 * @param request Requests one of the import's files.
 * @param list The files the import of a chunk needs, undefined when no list knows the chunk.
 * @param requestLists Requests the file that says which files an import needs.
 */
export function gateChunk<T, F>(
  request: (
    state: ChunkTranslationsState,
    locale: string,
    file: F
  ) => Promise<boolean>,
  list: (state: ChunkTranslationsState, chunk: string) => F[] | undefined,
  requestLists: typeof requestEntry,
  start: () => Promise<T>,
  named: string | 0,
  preload: PreloadChunk<T> | undefined,
  deps: string[] | undefined,
  url: string | undefined
): Promise<T> {
  const run = (load: () => Promise<T>) =>
    preload ? preload(load, deps, url) : load();
  const chunk = named || (deps && deps[0]);
  const locale = chunk ? getTranslatedLocale() : undefined;
  if (!chunk || locale === undefined) return run(start);
  const state = getState();
  const requestFiles = () => {
    const files = list(state, chunk);
    // The build names a chunk only when its import needs files, so the lists
    // know it. A chunk read from the bundler's list may need none, and is
    // then in no list.
    if (!files && named && !state.d) {
      state.d = true;
      console.warn(createUnlistedChunkWarning(chunk));
    }
    return Promise.all(
      (files || []).map((file) => request(state, locale, file))
    );
  };
  // Which files the import needs is known once the file that lists them has arrived
  const files = state.i
    ? requestFiles()
    : requestLists(state, locale).then(requestFiles);
  // The entry's file holds the messages the import's files leave out
  const translations =
    requestLists === requestEntry
      ? files
      : Promise.all([files, requestEntry(state, locale)]);
  // The bundler preloads the chunk when it lists it
  if (named || !preload) preloadChunk(state, chunk);
  return run(() =>
    translations.then(() => {
      addArrived(state);
      return start();
    })
  );
}

/** Undefined when the lists do not know the chunk. */
export function listImportedFiles(
  imported: ImportedFiles | undefined,
  chunk: string
): string[] | undefined {
  if (!imported) return [];
  const place = imported.k.indexOf(chunk.replace(/\.[cm]?js$/, ''));
  if (place < 0) return undefined;
  const needed = imported.c[place] || [];
  const files = needed[0] ? [imported.k[place]] : [];
  for (let pair = 1; pair < needed.length; pair += 2) {
    for (let next = 0; next < needed[pair + 1]; next++) {
      files.push(imported.k[needed[pair] + next]);
    }
  }
  return files;
}

/**
 * The URL a page imports a chunk from, for a link, which no import map
 * applies to. `chunk` is what the build names the chunk by: a specifier the
 * page's import map has, or the chunk's path from the build's base, which
 * the import map can have after the base, as `url` is. Without an import
 * map, and where nothing resolves a specifier, that is `url`.
 * @param resolve The page's `import.meta.resolve`.
 */
export function resolveChunkUrl(
  url: string,
  chunk: string,
  resolve: (specifier: string) => string
): string {
  try {
    return resolve(chunk);
  } catch {
    // A path, which is no specifier as it is written
  }
  try {
    return resolve(new URL(url, document.baseURI).href);
  } catch {
    return url;
  }
}

/**
 * Downloads a chunk without running it, as a `modulepreload` link does, so
 * the `import()` that waits for translations finds it loaded. A page that
 * preloads the chunk already keeps its own link.
 */
function preloadChunk(state: ChunkTranslationsState, chunk: string): void {
  const link = document.createElement('link');
  link.rel = 'modulepreload';
  // Requested as the import() requests it
  link.crossOrigin = '';
  link.href = resolveChunkUrl(
    (state.b || '') + chunk,
    chunk,
    // Not a function in an older browser, nor in the CommonJS build
    (specifier) => import.meta.resolve(specifier)
  );
  const links = document.getElementsByTagName('link');
  for (let index = 0; index < links.length; index++) {
    if (links[index].href === link.href) return;
  }
  document.head.appendChild(link);
}
