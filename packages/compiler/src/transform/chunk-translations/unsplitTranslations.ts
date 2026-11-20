import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import type { TranslationsTable } from './loadTranslationFiles';
import {
  CHUNK_TRANSLATIONS_GLOBAL,
  UNSPLIT_LOADER_PLACEHOLDER,
  type ChunkTranslations,
} from './resolveChunkTranslations';

/**
 * A build with chunk translations does not load a locale's catalog, so a
 * message that no compiled call site reads from a chunk's file would lose its
 * translation: `msg`, dictionaries, and a `<T>` hashed at runtime. Their
 * translations go into one more file per locale, the unsplit file, which the
 * page requests with the entry's file and gt-react reads as the catalog its
 * `loadTranslations` returns. A build without such messages writes no such
 * file and no code for one.
 */

/** The key of the unsplit file, inside the directory of the build's assets. */
export const UNSPLIT_TRANSLATIONS_KEY = 'gt-unsplit';

// What gt-react's chunk-translations entry waits for a file
const TIMEOUT_MS = 10_000;

/** What the startup script leaves on the shared object for the loader below. */
type UnsplitState = {
  /** The URL the build's files are served from */
  b?: string;
  /** Milliseconds to wait for a file */
  w?: number;
  /** The key of the unsplit file */
  u?: string;
  /** The hash in the name of the unsplit file, by locale */
  o?: Record<string, string>;
  /** The unsplit files requested, by locale */
  q?: Record<string, Promise<unknown> | undefined>;
};

/**
 * The translations of each locale that go into its unsplit file, for the
 * locales that have any: every entry of the locale's translations file whose
 * hash no call site reads from a chunk's file, or that some call site reads
 * from the catalog. A message of code the bundler dropped is in neither set
 * of files, since its call site was compiled to read from a chunk's.
 */
export function getUnsplitTranslations(
  table: TranslationsTable,
  build: Pick<ChunkTranslations, 'locales' | 'hashes' | 'unsplit'>
): Record<string, Record<string, unknown>> {
  const unsplit: Record<string, Record<string, unknown>> = {};
  for (const locale of build.locales) {
    const entries = Object.entries(table[locale] ?? {})
      .filter(
        ([hash, translation]) =>
          translation != null &&
          (!build.hashes.has(hash) || build.unsplit.has(hash))
      )
      .sort(([a], [b]) => (a < b ? -1 : 1));
    if (entries.length) unsplit[locale] = Object.fromEntries(entries);
  }
  return unsplit;
}

/**
 * The hashes of the messages that only code of a server uses: every hash a
 * call site of a build for a server passes and no call site of the client
 * build does. The unsplit file holds what no chunk's file does, so that a
 * call site the build cannot read still finds its translation, and without
 * this it would hold every message of the server's code too.
 *
 * A message that both sides use is passed by a call site of the client
 * build, and stays. A call site of the client that hashes its message when
 * it runs is not known to pass anything: a message it shares with server
 * code alone is taken out with the rest.
 */
export function getServerOnlyHashes(
  build: Pick<ChunkTranslations, 'hashes' | 'unsplit' | 'serverHashes'>
): string[] {
  return [...build.serverHashes]
    .filter((hash) => !build.hashes.has(hash) && !build.unsplit.has(hash))
    .sort();
}

/**
 * The `loadTranslations` of a build with unsplit files: resolves to the
 * locale's file, or to no translations when the locale has no file, the file
 * fails, or it takes longer than the timeout, each of the last two with a
 * warning. Written into the chunk that starts the app with `toString()`, so
 * it uses nothing outside its own body.
 */
function loadUnsplitTranslations(
  locale: string,
  globalName: string,
  timeout: number,
  lateWarning: string,
  failedWarning: string
): Promise<object> {
  const state = (globalThis as unknown as Record<string, UnsplitState>)[
    globalName
  ];
  const hash = state && state.o && state.o[locale];
  if (!hash) return Promise.resolve({});
  const url = (state.b || '') + state.u + '.' + locale + '.' + hash + '.json';
  const requests = state.q || (state.q = {});
  // The startup script's request, or the one a failed request left room for
  const request =
    requests[locale] ||
    (requests[locale] = fetch(url).then((response) => {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    }));
  const wait = state.w == null ? timeout : state.w;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      console.warn(
        lateWarning.replace('{url}', url).replace('{timeout}', String(wait))
      );
      resolve({});
    }, wait);
    request.then(
      (file) => {
        clearTimeout(timer);
        resolve(file && typeof file === 'object' ? file : {});
      },
      (error) => {
        clearTimeout(timer);
        requests[locale] = undefined;
        console.warn(
          failedWarning.replace('{url}', url).replace('{error}', String(error))
        );
        resolve({});
      }
    );
  });
}

const LATE_WARNING = createDiagnosticMessage({
  source: 'gt-react',
  severity: 'Warning',
  whatHappened: 'The translations in {url} did not load within {timeout} ms',
  reassurance: 'Their messages render the source text',
});

const FAILED_WARNING = createDiagnosticMessage({
  source: 'gt-react',
  severity: 'Warning',
  whatHappened: 'Could not load the translations in {url}',
  reassurance: 'Their messages render the source text',
  fix: 'Deploy the .json files the build wrote next to its chunks',
  details: '{error}',
});

export const UNSPLIT_LOADER_ERROR = createDiagnosticMessage({
  source: '@generaltranslation/compiler',
  severity: 'Error',
  whatHappened:
    'experimentalSplitTranslations could not write the loader of the unsplit translations',
  why: 'the bundler printed the call that starts the app in a form the build does not read',
  fix: 'Turn the option off, or write every message as <T> or a t template from gt-react so no translation is left unsplit',
});

// initialize(initializeGTSPA, config, "<placeholder>"), as a bundler prints
// the call the compiler wrote, before it minifies
const START_CALL = new RegExp(
  `([\\w$.]+)\\(\\s*([\\w$.]+)\\s*,\\s*([\\w$.]+)\\s*,\\s*(["'\`])${UNSPLIT_LOADER_PLACEHOLDER}\\4\\s*\\)`,
  'g'
);
const LAST_ARGUMENT = new RegExp(
  `,\\s*(["'\`])${UNSPLIT_LOADER_PLACEHOLDER}\\1`,
  'g'
);

/**
 * Takes the placeholder out of the call that starts the app, in a chunk the
 * bundler has rendered and not yet minified or named. Without unsplit files
 * the call is left as the compiler wrote it. With them, gt-react's
 * `initializeGTSPA` is given a `loadTranslations` that adds the unsplit file
 * to what gt-react's loader returns.
 * Undefined when the chunk holds no placeholder.
 */
export function replaceUnsplitLoader(
  code: string,
  hasUnsplit: boolean
): string | undefined {
  if (!code.includes(UNSPLIT_LOADER_PLACEHOLDER)) return undefined;
  if (!hasUnsplit) return code.replace(LAST_ARGUMENT, '');
  const data = [
    CHUNK_TRANSLATIONS_GLOBAL,
    TIMEOUT_MS,
    LATE_WARNING,
    FAILED_WARNING,
  ].map((value) => JSON.stringify(value));
  const loader = `(locale) => (${loadUnsplitTranslations.toString()})(${['locale', ...data].join(', ')})`;
  const replaced = code.replace(
    START_CALL,
    (_match, initialize: string, initializeSpa: string, config: string) =>
      `${initialize}((config) => ${initializeSpa}({ ...config, loadTranslations: (locale) => (${loader})(locale).then((unsplit) => config.loadTranslations(locale).then((loaded) => ({ ...unsplit, ...loaded }))) }), ${config})`
  );
  if (replaced.includes(UNSPLIT_LOADER_PLACEHOLDER)) {
    throw new Error(UNSPLIT_LOADER_ERROR);
  }
  return replaced;
}

export const createUnsplitTranslationsMessage = (
  files: { locale: string; count: number; bytes: number }[]
) =>
  createDiagnosticMessage({
    source: '@generaltranslation/compiler',
    severity: 'Warning',
    whatHappened: `Some translations are not split by chunk: ${files
      .map(
        ({ locale, count, bytes }) =>
          `${count} for "${locale}" (${(bytes / 1000).toFixed(1)} kB)`
      )
      .join(', ')}`,
    why: 'no <T> or t template from gt-react that this build compiled reads them, as with msg and dictionaries',
    reassurance:
      'They stay translated: each locale loads them in one file when the app starts',
    fix: 'Write those messages as <T> or t templates to load them with their chunks',
  });
