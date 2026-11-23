import { preloadTranslations } from '@generaltranslation/react-core/pure';
import type { SplitTranslationsState } from 'generaltranslation/internal';
import type {
  ChunkTranslationsState,
  MinifiedTranslations,
  Translations,
} from './state';
import { getState, getTranslatedLocale } from './state';
import {
  addArrived,
  getFileUrl,
  register,
  request,
  requestEntry,
  takeArrived,
} from './request';

/**
 * What a server sends with a page it rendered, in a build that splits
 * translations, for the page's loader to start with in place of the startup
 * script of a client-rendered app. `createChunkTranslationsSeed()` from
 * `gt-react/chunk-translations/server` makes it; it is plain JSON.
 */
export type ChunkTranslationsSeed = {
  /** What the loader starts with: where the build's files are and what names them */
  s: SplitTranslationsState;
  /**
   * The translations the page hydrates with, by what its call sites pass.
   * Without them, as in a page that every visitor gets whatever their
   * locale, the page loads the files it starts with itself.
   */
  t?: Translations;
  /** The files of the chunks whose imports need nothing but `t` */
  c?: string[];
  /** The keys of the files whose translations `t` holds */
  k?: string[];
  /**
   * In a seed without `t`: the translations of the messages that the
   * server's own code can send the page as data, by locale and hash. No file
   * the page loads holds them for sure.
   */
  m?: Record<string, Translations>;
};

/**
 * The `loadTranslations` of an app whose pages are seeded: a locale's whole
 * catalog is never loaded, so a load of the locale takes what has arrived for
 * it.
 */
export function loadSeededTranslations(locale: string): Promise<Translations> {
  return Promise.resolve(takeArrived(getState(), locale));
}

/**
 * Starts the loader of a page with what its server sent, before the page
 * hydrates and once the page's locale is set. Resolves once the translations
 * of what the page hydrates are in the translations cache, which must be
 * initialized with `loadSeededTranslations`. In a locale that renders the
 * source there is nothing to wait for.
 *
 * - The imports of the chunks the seed names then run without waiting.
 * - Every other import loads its files as in a client-rendered app, but for
 *   those the seed holds.
 * - Which files an import needs is requested once the browser is idle, so the
 *   first navigation does not wait for it.
 */
export function seedChunkTranslations(
  seed: ChunkTranslationsSeed
): Promise<void> {
  const state: ChunkTranslationsState = Object.assign(getState(), seed.s);
  const locale = getTranslatedLocale();
  if (locale === undefined) return Promise.resolve();
  if (seed.m) register(state, locale, seed.m[locale]);
  const started = seed.t
    ? holdSeeded(state, locale, seed.t, seed.c || [], seed.k || [])
    : Promise.all([
        requestEntry(state, locale),
        requestUnsplit(state, locale),
        ...requestHeld(state, locale),
      ]);
  return Promise.resolve(started)
    .then(() => preloadTranslations(locale))
    .then(() => {
      state.y = true;
      addArrived(state);
    });
}

function holdSeeded(
  state: ChunkTranslationsState,
  locale: string,
  translations: Translations,
  chunks: string[],
  files: string[]
): void {
  register(state, locale, translations);
  const requests = (state.r ||= {});
  for (const file of files)
    requests[`${locale} ${file}`] = Promise.resolve(true);
  const seeded = (state.s ||= {});
  for (const chunk of chunks) seeded[chunk] = 1;
  if (state.k !== undefined) {
    // In a build with maps the entry's file holds translations alone, and the
    // first import that needs the map requests it
    requests[locale] = Promise.resolve(true);
    return;
  }
  // A locale the build has no files for was seeded with every chunk
  if (state.h?.[locale] === undefined) return;
  // Safari has no requestIdleCallback
  const idle =
    globalThis.requestIdleCallback ?? ((run: () => void) => setTimeout(run, 1));
  idle(() => void requestEntry(state, locale));
}

const read =
  (state: ChunkTranslationsState, locale: string) =>
  (translations: Translations | MinifiedTranslations) =>
    register(state, locale, translations);

function requestUnsplit(
  state: ChunkTranslationsState,
  locale: string
): Promise<boolean> | undefined {
  const hash = state.o?.[locale];
  if (state.u === undefined || hash === undefined) return undefined;
  return request(
    state,
    `unsplit ${locale}`,
    getFileUrl(state, state.u, locale, hash),
    undefined,
    read(state, locale)
  );
}

/** The files the entry holds, in a build that splits by module. */
function requestHeld(
  state: ChunkTranslationsState,
  locale: string
): Promise<boolean>[] {
  const held = state.e?.[locale] || {};
  return Object.keys(held).map((file) =>
    request(
      state,
      // What an import that needs the file requests it by
      `${locale} ${file}`,
      getFileUrl(state, file, locale, held[file]),
      undefined,
      read(state, locale)
    )
  );
}
