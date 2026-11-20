import {
  getI18nConfig,
  getReadonlyConditionStore,
} from '@generaltranslation/react-core/pure';
import type { Content } from '@generaltranslation/format';

export type Translations = Record<string, Content>;

/**
 * What a file holds in a build with the compiler's hash minification, in
 * place of an entry per id: its translations, each once, and for the list
 * of each chunk that reads some of them, runs of three numbers. A run is a
 * place in the list, the place of its translation in the file, and how many
 * places follow on from both. An id is the name of its list, a `.`, and its
 * place in the list: `[12, 0, 2]` under `kR3_x0Qa` gives `kR3_x0Qa.12` the
 * file's first translation and `kR3_x0Qa.13` its second.
 */
export type MinifiedTranslations = [
  translations: Content[],
  lists: Record<string, number[]>,
];

/**
 * The entry's file for a locale. A locale's map, in a build that names each
 * file by its own hash, is the same without translations: there the entry's
 * file holds only those, and the map what names a chunk.
 */
export type EntryFile = {
  /** The translations of the entry chunk and its static imports, by hash */
  t?: Translations | MinifiedTranslations;
  /** The files each dynamic import needs */
  i?: ImportedFiles;
};

/**
 * The files each dynamic import needs, as the compiler's
 * `renderImportedFiles()` writes them. The entry's file holds them, and in a
 * build that names each file by its own hash, the locale's map does.
 */
export type ImportedFiles = {
  /** The keys of those files and of the imported chunks */
  k: string[];
  /**
   * For the chunk whose key is at the same place in `k`: whether its import
   * needs the file of that key, then the other files it needs, as places in
   * `k` in pairs of the first and how many follow on from it.
   */
  c: (number[] | 0 | undefined)[];
  /**
   * In a locale's map: the hash in the name of the file whose key is at the
   * same place in `k`, 0 when the locale has no such file
   */
  h?: (string | 0 | undefined)[];
};

/** Vite's preload call, which adds links for `deps` and then calls `load`. */
export type PreloadChunk<T> = (
  load: () => Promise<T>,
  deps: string[] | undefined,
  url: string | undefined
) => Promise<T>;

/**
 * What the page's startup script leaves on `globalThis` for this entry, with
 * what this entry keeps there. The compiler writes the first seven.
 * @internal
 */
export type ChunkTranslationsState = {
  /** The URL the build's files are served from */
  b?: string;
  /**
   * The key of the entry's file: the entry chunk's file without its
   * extension. In a build that names each file by its own hash, the key of
   * every file that holds translations.
   */
  f?: string;
  /** The hash in the name of the entry's file, by locale */
  h?: Record<string, string>;
  /**
   * In a build that splits by module, where `f` and `h` are of the locale's
   * map: the hash in the name of each file the entry holds, by locale and key
   */
  e?: Record<string, Record<string, string> | undefined>;
  /**
   * The token in the name of every other file of a locale, by locale. In a
   * build that names each file by its own hash, the token in the name of the
   * locale's map of those hashes.
   */
  v?: Record<string, string>;
  /** The key of the maps, in a build that has them */
  k?: string;
  /** The maps the startup script requested, by locale */
  m?: Record<string, Promise<unknown> | undefined>;
  /** The locale the startup script read */
  l?: string;
  /** The entry's files the startup script requested, by locale */
  p?: Record<string, Promise<unknown> | undefined>;
  /**
   * The files of preloaded chunks the startup script requested, by locale
   * and key. In a build that names each file by its own hash, by locale and
   * that hash, as chunks whose files hold the same have one file.
   */
  g?: Record<string, Promise<unknown> | undefined>;
  /** Milliseconds to wait for a file */
  w?: number;
  /**
   * The translations that have arrived and are not in the translations cache
   * yet, by locale and hash
   */
  t?: Record<string, Translations>;
  /** Whether the translations cache has loaded the locale */
  y?: boolean;
  /**
   * The files each dynamic import needs, once the file that holds them has
   * arrived: an entry's file, or the locale's map
   */
  i?: ImportedFiles;
  /**
   * Whether each requested file arrived in time: the entry's by locale, any
   * other by what the startup script requests it by
   */
  r?: Record<string, Promise<boolean> | undefined>;
  /** Whether the page was warned of a chunk the build named and the lists do not know */
  d?: boolean;
  /**
   * The key of the file that says what the locale's files are named by in
   * the build the host serves now, and what says how this page's build
   * assigned messages to files. The compiler writes both, as the fields
   * above `l`.
   */
  n?: string;
  c?: string;
  /** The reading of that file that is on its way */
  x?: Promise<void>;
  /**
   * In a build with maps: the lists of the map of the build that is served
   * now, read when a file was missing, and the hash in that map's name
   */
  j?: ImportedFiles;
  a?: string;
  /**
   * The URLs the host did not have: true where nothing is asked for in its
   * place. In a build that splits by module, false while the lists that
   * could stand in for the file are read, and once they do
   */
  z?: Record<string, boolean | undefined>;
  /**
   * Whether the page reads files of the build that is served now in place
   * of its own, which can hold another translation of a message on screen
   */
  s?: boolean;
};

export type InitializeConfig = { loadTranslations?: unknown };

export function getState(): ChunkTranslationsState {
  const scope = globalThis as {
    __GT_CHUNK_TRANSLATIONS__?: ChunkTranslationsState;
  };
  return (scope.__GT_CHUNK_TRANSLATIONS__ ||= {});
}

/** The locale to load translations for, or undefined when the source renders. */
export function getTranslatedLocale(): string | undefined {
  let locale: string;
  try {
    const store = getReadonlyConditionStore();
    if (!store.getEnableI18n()) return undefined;
    locale = store.getLocale();
  } catch {
    // A chunk imported before initializeGTSPA() has only the startup script's locale
    return getState().l;
  }
  return getI18nConfig().requiresTranslation({ locale }) ? locale : undefined;
}
