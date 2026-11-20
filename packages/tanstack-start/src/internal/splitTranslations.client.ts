// The browser's side of split translations. gt-react's loader of split
// translations does the loading:
// the compiler wraps every dynamic import with it, the router's lazy route
// imports included, so navigation and preloading request a route's files
// with its chunks. This module only starts that loader with what the server
// sent, in place of the startup script and `initializeGTSPA()` of a
// client-rendered app.
import {
  _addArrived as addArrived,
  _fetchJson as fetchJson,
  _getChunkTranslationsState as getState,
  _register as register,
  _requestEntry as requestEntry,
  _takeArrived as takeArrived,
  loadChunkTranslations,
  loadRegionChunkTranslations,
} from 'gt-react/chunk-translations';
import type * as Disabled from './splitTranslations';

type Registered = Parameters<typeof register>[2];

export const getSplitPayload: typeof Disabled.getSplitPayload = async () =>
  undefined;

export const getSplitShellPayload: typeof Disabled.getSplitShellPayload = () =>
  undefined;

export const preloadSplitFiles: typeof Disabled.preloadSplitFiles = () =>
  undefined;

/**
 * The cache's loader: the locale's whole catalog is never loaded, so a load
 * of the locale takes what has arrived for it.
 */
export const splitLoadTranslations: typeof Disabled.splitLoadTranslations = (
  locale
) => Promise.resolve(takeArrived(getState(), locale));

/**
 * Runs before the page hydrates: resolves once the translations of
 * everything it hydrates are in the cache.
 */
export const hydrateSplit: typeof Disabled.hydrateSplit = async (
  payload,
  locale
) => {
  // A prerendered shell names every locale's files; the source locale has none
  const start = payload.s ?? payload.a?.[locale];
  if (!start) return;
  const state = Object.assign(getState(), start);
  const { c: chunks = [], k: keys = Object.keys(start.e?.[locale] ?? {}) } =
    payload;
  if (payload.t) {
    // The server sent the files' content with the page
    const { e, u, f } = payload.t;
    const requests = (state.r ||= {});
    if (e) {
      const entry = e as { t?: Registered; i?: typeof state.i };
      register(state, locale, entry.t);
      if (entry.i) state.i = entry.i;
      requests[locale] = Promise.resolve(true);
    }
    if (u) register(state, locale, u as Registered);
    for (const key of Object.keys(f)) {
      register(state, locale, f[key] as Registered);
      requests[`${locale} ${key}`] = Promise.resolve(true);
    }
    state.s = Object.fromEntries(chunks.map((chunk) => [chunk, 1]));
  } else {
    // The browser loads the files: those the server asked it to preload, or
    // for a prerendered shell, the entry's
    const unsplit = state.u && state.o?.[locale];
    await Promise.all([
      requestEntry(state, locale),
      unsplit &&
        fetchJson(`${state.b || ''}${state.u}.${locale}.${unsplit}.json`).then(
          (file) => register(state, locale, file as Registered),
          (error: unknown) =>
            console.warn(
              `gt-tanstack-start: could not load the unsplit translations: ${String(error)}`
            )
        ),
      payload.m === 'module'
        ? loadRegionChunkTranslations(keys)
        : loadChunkTranslations(keys),
    ]);
  }
  state.y = true;
  addArrived(state);
  // The lists of the files each import needs, which the first preload or
  // navigation would otherwise wait for
  if (!state.i) {
    // Safari has no requestIdleCallback
    const idle =
      globalThis.requestIdleCallback ??
      ((run: () => void) => setTimeout(run, 1));
    idle(() => void requestEntry(state, locale));
  }
};
