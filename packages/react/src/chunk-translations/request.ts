import { getReactI18nCache } from '@generaltranslation/react-core/pure';
import type { ChunkTranslationsState, EntryFile, Translations } from './state';
import {
  createFailedWarning,
  createMissingLocaleWarning,
  createTimeoutWarning,
} from './warnings';

export function requestEntry(
  state: ChunkTranslationsState,
  locale: string
): Promise<boolean> {
  const hash = state.h?.[locale];
  const entry = state.f;
  if (entry === undefined || hash === undefined) {
    // Kept, so the page is warned once
    return ((state.r ||= {})[locale] ||= warnMissingLocale(state, locale));
  }
  const requested = state.p?.[locale];
  if (requested) state.p![locale] = undefined;
  return request(
    state,
    locale,
    getFileUrl(state, entry, locale, hash),
    requested,
    (file: EntryFile) => {
      register(state, locale, file.t);
      // Elsewhere when the build has maps
      if (file.i) state.i = file.i;
    }
  );
}

export function warnMissingLocale(
  state: ChunkTranslationsState,
  locale: string
): Promise<boolean> {
  console.warn(createMissingLocaleWarning(locale, state.v === undefined));
  return Promise.resolve(false);
}

// The compiler's getFileName() writes files by the same name
export function getFileUrl(
  state: ChunkTranslationsState,
  file: string,
  locale: string,
  hash: string
): string {
  return `${state.b || ''}${file}.${locale}.${hash}.json`;
}

export function register(
  state: ChunkTranslationsState,
  locale: string,
  translations: Translations | undefined
): void {
  Object.assign(((state.t ||= {})[locale] ||= {}), translations);
}

/**
 * Adds the files that have arrived to the translations cache, in one call:
 * each call copies the locale's whole table. A load of the locale that is
 * still running would replace what is added before it resolves, so until it
 * has, they wait for it to take them.
 */
export function addArrived(state: ChunkTranslationsState): void {
  if (!state.y || !state.t) return;
  const arrived = state.t;
  state.t = undefined;
  getReactI18nCache().updateTranslations(arrived);
}

/** What has arrived for a locale, which its load takes. */
export function takeArrived(
  state: ChunkTranslationsState,
  locale: string
): Translations {
  const arrived = state.t?.[locale] || {};
  if (state.t) delete state.t[locale];
  return arrived;
}

/**
 * Requests a file once, and resolves to whether it arrived in time.
 *
 * - A file that fails is requested again by the next import that needs it.
 * - A file that is late is not waited for again: what needs it renders the
 *   source until it arrives, and it is still read when it does.
 *
 * @param requested The request, when the startup script made it already.
 */
export function request<F extends object>(
  state: ChunkTranslationsState,
  key: string,
  url: string,
  requested: Promise<unknown> | undefined,
  read: (file: F) => void
): Promise<boolean> {
  const requests = (state.r ||= {});
  return (requests[key] ||= new Promise((resolve) => {
    const timeout = getTimeout(state);
    let late = false;
    const timer = setTimeout(() => {
      late = true;
      console.warn(createTimeoutWarning(url, timeout));
      requests[key] = Promise.resolve(false);
      resolve(false);
    }, timeout);
    const fail = (details: string) => {
      clearTimeout(timer);
      console.warn(createFailedWarning(url, details));
      requests[key] = undefined;
      resolve(false);
    };
    (requested || fetchJson(url)).then(
      (file) => {
        if (!file || typeof file !== 'object') {
          fail('The file is not a JSON object');
          return;
        }
        clearTimeout(timer);
        read(file as F);
        // A late file is read when it arrives, as nothing waits for it
        if (late) addArrived(state);
        requests[key] = Promise.resolve(true);
        resolve(true);
      },
      (error: unknown) => fail(String(error))
    );
  }));
}

function fetchJson(url: string): Promise<unknown> {
  return fetch(url).then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  });
}

function getTimeout(state: ChunkTranslationsState): number {
  return state.w ?? 10_000;
}
