import type {
  ChunkTranslationsState,
  EntryFile,
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
  warnMissingLocale,
} from './request';
import { gateChunk } from './gate';
import { initializeChunkTranslations } from './initialize';

/**
 * `initializeChunkTranslations()` for a build that names each file by the
 * hash of its own content (the compiler's `map` naming): also reads the
 * locale's map of those hashes when it arrives, without waiting for it.
 * @internal
 */
export function initializeMappedChunkTranslations<C extends InitializeConfig>(
  initialize: (config: C) => Promise<void>,
  config: C
): Promise<void> {
  const initialized = initializeChunkTranslations(initialize, config);
  const locale = getTranslatedLocale();
  if (locale !== undefined) void requestMap(getState(), locale);
  return initialized;
}

/**
 * `loadChunk()` for such a build: the map says which files the import needs
 * and the hash in the name of each, so a file is requested once the map has
 * arrived, and the import runs once both have.
 * @internal
 */
export function loadMappedChunk<T>(
  start: () => Promise<T>,
  chunk: string | 0,
  preload?: PreloadChunk<T>,
  deps?: string[],
  url?: string
): Promise<T> {
  return gateChunk(
    requestMappedFile,
    requestMap,
    start,
    chunk,
    preload,
    deps,
    url
  );
}

/** `loadChunkTranslations()` for such a build. */
export function loadMappedChunkTranslations(
  files: readonly string[]
): Promise<void> | undefined {
  const locale = files.length ? getTranslatedLocale() : undefined;
  if (locale === undefined) return undefined;
  const state = getState();
  return Promise.all(
    files.map((file) => requestMappedFile(state, locale, file))
  ).then(() => addArrived(state));
}

function requestMappedFile(
  state: ChunkTranslationsState,
  locale: string,
  file: string
): Promise<boolean> {
  const listed = state.i;
  if (!listed) {
    return requestMap(state, locale).then((loaded) =>
      loaded && state.i ? requestMappedFile(state, locale, file) : false
    );
  }
  const hash = listed.h?.[listed.k.indexOf(file)];
  // The map lists the files that exist
  if (!hash || state.f === undefined) return Promise.resolve(true);
  // Named by what it holds alone, so chunks whose files hold the same share it
  const key = `${locale} ${hash}`;
  const requested = state.g?.[key];
  if (requested) state.g![key] = undefined;
  return request(
    state,
    key,
    getFileUrl(state, state.f, locale, hash),
    requested,
    (translations: Translations) => register(state, locale, translations)
  );
}

function requestMap(
  state: ChunkTranslationsState,
  locale: string
): Promise<boolean> {
  const token = state.v?.[locale];
  if (state.k === undefined || token === undefined) {
    // Kept, so the page is warned once, for the entry's file or for this
    return ((state.r ||= {})[locale] ||= warnMissingLocale(state, locale));
  }
  const requested = state.m?.[locale];
  if (requested) state.m![locale] = undefined;
  return request(
    state,
    `map ${locale}`,
    getFileUrl(state, state.k, locale, token),
    requested,
    (map: EntryFile) => {
      state.i = map.i;
    }
  );
}
