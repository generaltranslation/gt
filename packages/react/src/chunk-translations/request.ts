import { getReactI18nCache } from '@generaltranslation/react-core/pure';
import type {
  ChunkTranslationsState,
  EntryFile,
  ImportedFiles,
  MinifiedTranslations,
  Translations,
} from './state';
import {
  createFailedWarning,
  createMissingLocaleWarning,
  createTimeoutWarning,
  createUnwaitedWarning,
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
      if (file.i) readLists(state, file.i);
    }
  );
}

/**
 * Keeps the lists of the files each import needs, and requests the files of
 * the imports that ran without them.
 */
export function readLists(
  state: ChunkTranslationsState,
  lists: ImportedFiles | undefined
): void {
  state.i = lists;
  const unlisted = state.il;
  if (!lists || !unlisted) return;
  state.il = undefined;
  const waits = (state.wt ||= [0]);
  waits[2] = true;
  for (const key in unlisted) void unlisted[key]();
  waits[2] = false;
}

/**
 * Requests files once the lists that name them have arrived, for what ran
 * when they were late or failed. Nothing waits for these files.
 * @param key What is asked for: once, however often it ran without the lists.
 */
export function requestOnceListed(
  state: ChunkTranslationsState,
  key: string,
  requestFiles: () => Promise<unknown>
): void {
  (state.il ||= {})[key] = requestFiles;
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

/**
 * Keeps what a file holds until the translations cache takes it. A file of
 * a build with hash minification is read into an entry per id, each of
 * which holds the file's one copy of its translation.
 */
export function register(
  state: ChunkTranslationsState,
  locale: string,
  translations: Translations | MinifiedTranslations | undefined
): void {
  const arrived = ((state.t ||= {})[locale] ||= {});
  if (!Array.isArray(translations)) {
    Object.assign(arrived, translations);
    return;
  }
  const [held, lists] = translations;
  for (const name in lists) {
    const runs = lists[name];
    for (let run = 0; run < runs.length; run += 3) {
      for (let next = 0; next < runs[run + 2]; next++) {
        arrived[`${name}.${runs[run] + next}`] = held[runs[run + 1] + next];
      }
    }
  }
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
 * - Once the wait for a file has run out, no file is waited for until one
 *   has arrived in time, see `getWait()`.
 * - A file the host does not have is one it answers 404 or 410 for, or
 *   answers with something that is not JSON, as a host does that serves a
 *   page for every path it has no file for. Only then is `recover` called,
 *   once for a URL, and the time it takes is within this request's timeout.
 *
 * @param requested The request, when the startup script made it already.
 * @param recover Asks for what stands in for the file: resolves to whether that arrived in time, or to undefined when nothing does.
 */
export function request<F extends object>(
  state: ChunkTranslationsState,
  key: string,
  url: string,
  requested: Promise<unknown> | undefined,
  read: (file: F) => void,
  recover?: () => Promise<boolean | undefined>
): Promise<boolean> {
  const requests = (state.r ||= {});
  return (requests[key] ||= new Promise((resolve) => {
    const timeout = getWait(state);
    const start = Date.now();
    const waits = (state.wt ||= [0]);
    const inTime = waits[0];
    // Late from the start when nothing waits for it
    let late = !timeout;
    const timer = setTimeout(() => {
      late = true;
      if (timeout) waits[1] = inTime;
      console.warn(
        timeout
          ? createTimeoutWarning(url, timeout)
          : createUnwaitedWarning(url)
      );
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
        if (Date.now() - start < getTimeout(state)) waits[0]++;
        read(file as F);
        // A late file is read when it arrives, as nothing waits for it
        if (late) addArrived(state);
        requests[key] = Promise.resolve(true);
        resolve(true);
      },
      (error: unknown) => {
        const details = String(error);
        const missing = (state.z ||= {});
        const recovered =
          recover &&
          missing[url] === undefined &&
          (error instanceof SyntaxError || /HTTP 4(04|10)$/.test(details))
            ? recover()
            : undefined;
        if (!recovered) {
          fail(details);
          return;
        }
        void recovered.then((arrived) => {
          if (arrived === undefined) {
            missing[url] = true;
            if (!late) fail(details);
          } else if (late) {
            if (arrived) addArrived(state);
          } else {
            clearTimeout(timer);
            resolve(arrived);
          }
        });
      }
    );
  }));
}

export function fetchJson(
  url: string,
  options?: RequestInit
): Promise<unknown> {
  return (options ? fetch(url, options) : fetch(url)).then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  });
}

export function getTimeout(state: ChunkTranslationsState): number {
  return state.w ?? 10_000;
}

/**
 * How long a file that is requested now is waited for: the timeout, and not
 * at all once the wait for a file has run out, until a file has arrived
 * within the timeout of its own request since that late file was requested.
 * A host that answers no file in time so costs a page one wait, and not one
 * more for each import that the code of another import starts. Nor is a
 * file waited for that `readLists()` requests, for an import that has run.
 */
export function getWait(state: ChunkTranslationsState): number {
  const [inTime, late, ran] = state.wt || [0];
  return !ran && (late === undefined || inTime > late) ? getTimeout(state) : 0;
}
