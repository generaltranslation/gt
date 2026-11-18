import type {
  ChunkTranslationsState,
  InitializeConfig,
  PreloadChunk,
  Translations,
} from './state';
import { getState, getTranslatedLocale } from './state';
import {
  addArrived,
  getFileUrl,
  register,
  request,
  requestEntry,
} from './request';
import { gateChunk } from './gate';
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

function requestRegionFile(
  state: ChunkTranslationsState,
  locale: string,
  file: string
): Promise<boolean> {
  const listed = state.i;
  const hash = state.e?.[locale]?.[file] || listed?.h?.[listed.k.indexOf(file)];
  // The map lists the files that exist
  if (!hash) return Promise.resolve(true);
  const key = `${locale} ${file}`;
  const requested = state.g?.[key];
  if (requested) state.g![key] = undefined;
  return request(
    state,
    key,
    getFileUrl(state, file, locale, hash),
    requested,
    (translations: Translations) => register(state, locale, translations)
  );
}
