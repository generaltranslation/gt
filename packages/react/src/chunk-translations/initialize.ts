import type { ChunkTranslationsState, InitializeConfig } from './state';
import { getState, getTranslatedLocale } from './state';
import { addArrived, requestEntry, takeArrived } from './request';

/**
 * Starts gt-react for a build with chunk translations: the locale's whole
 * catalog is not loaded, and the returned promise also waits for the entry's
 * translations.
 * @param initialize gt-react's `initializeGTSPA`.
 * @internal
 */
export function initializeChunkTranslations<C extends InitializeConfig>(
  initialize: (config: C) => Promise<void>,
  config: C
): Promise<void> {
  const state = getState();
  const initialized = initializeCache(initialize, config, state);
  const locale = getTranslatedLocale();
  return Promise.all([
    initialized,
    locale === undefined ? undefined : requestEntry(state, locale),
  ]).then(() => addArrived(state));
}

/**
 * Starts gt-react with a cache that loads the locale with what has arrived so
 * far; `initializeGTSPA()` keeps it for good. The condition store exists once
 * `initialize` returns.
 */
export function initializeCache<C extends InitializeConfig>(
  initialize: (config: C) => Promise<void>,
  config: C,
  state: ChunkTranslationsState
): Promise<void> {
  return initialize({
    ...config,
    loadTranslations: (locale: string) =>
      Promise.resolve(takeArrived(state, locale)),
  }).then(() => {
    state.y = true;
  });
}
