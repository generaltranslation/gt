import type { ChunkTranslationsState, EntryFile } from './state';
import { addArrived, fetchJson, getFileUrl, getTimeout } from './request';

/** The file of current names, see the compiler's `renderCurrentNames()`. */
type CurrentNames = { v?: Record<string, unknown>; c?: unknown };

/**
 * Whether the build that is served now assigned messages to files as this
 * page's build did: it then differs in translations alone, and a file of it
 * holds the messages that the page's file of the same key held.
 */
export function isSameAssignment(
  state: ChunkTranslationsState,
  current: CurrentNames
): boolean {
  return state.c !== undefined && current.c === state.c;
}

/**
 * Reads the map that `name` names, of the build that is served now, into
 * `j`, unless the page holds it. `own` names the map of the page's build.
 */
export function readCurrentMap(
  state: ChunkTranslationsState,
  locale: string,
  key: string | undefined,
  own: string | undefined,
  name: string
): Promise<void> | undefined {
  if (key === undefined || name === (state.a ?? own)) return undefined;
  if (name === own) {
    // The page's own build is served again
    state.j = state.a = undefined;
    return undefined;
  }
  return fetchJson(getFileUrl(state, key, locale, name)).then((map) => {
    state.j = (map as EntryFile | null)?.i;
    state.a = name;
  });
}

/**
 * Reads what the locale's files are named by in the build the host serves
 * now, from the one file of a build whose name is the same in every build,
 * and gives it to `take`. Resolves when `take` has, whatever came of it.
 *
 * A page asks for a file by the name its own build gave it. Only when the
 * host does not have it does this run, and what the page may ask for in the
 * file's place is the caller's rule: a file of the same key where the build
 * that is served now differs from the page's in translations alone, see
 * `isSameAssignment()`, and what that build lists for the chunk in a build
 * that splits by module. Without such a file, the missing one fails as any
 * file does: a warning, and the source text of its messages.
 *
 * - Nothing reads this on a host that keeps the files of earlier builds.
 * - One reading serves every file that is missing while it is on its way,
 *   and its time is within the timeout of the file that started it.
 * - What the page has loaded stays, so a page can show translations of the
 *   build it is of next to those of the build that is served now.
 */
export function readCurrentNames(
  state: ChunkTranslationsState,
  locale: string,
  take: (name: string, current: CurrentNames) => unknown
): Promise<void> {
  const key = state.n;
  if (key === undefined) return Promise.resolve();
  return (state.x ||= fetchJson(
    // `no-store` passes the browser's cache alone: a host's cache that keys
    // on the query has no copy of a URL that is new each time
    `${state.b || ''}${key}.json?${Date.now()}`,
    { cache: 'no-store' }
  )
    .then((current) => {
      const name = (current as CurrentNames | null)?.v?.[locale];
      return typeof name === 'string'
        ? take(name, current as CurrentNames)
        : undefined;
    })
    .catch(() => {})
    .then(() => {
      state.x = undefined;
    }));
}

/**
 * `loading`, or false once the timeout of a file requested at `start` has
 * passed. What arrives after that is still added.
 */
export function within(
  state: ChunkTranslationsState,
  start: number,
  loading: Promise<boolean>
): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(
      () => {
        resolve(false);
        // Also when one of several files failed: the others arrived
        void loading.then(() => addArrived(state));
      },
      Math.max(0, start + getTimeout(state) - Date.now())
    );
    void loading.then((arrived) => {
      clearTimeout(timer);
      resolve(arrived);
    });
  });
}
