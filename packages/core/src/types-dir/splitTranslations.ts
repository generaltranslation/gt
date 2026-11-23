/**
 * What the loader of split translations in a page starts with: where the
 * build's translation files are and what names them. The compiler writes it
 * into the startup script of a client-rendered app, and hands it to the
 * plugin of a framework that renders on a server. gt-react's loader keeps it
 * on its `ChunkTranslationsState`.
 */
export type SplitTranslationsState = {
  /** The URL the build's files are served from */
  b: string;
  /**
   * The key of the entry's file: the entry chunk's file without its
   * extension. In a build that names each file by its own hash, the key of
   * every file that holds translations.
   */
  f: string;
  /** The hash in the name of the entry's file, by locale */
  h: Record<string, string>;
  /**
   * The token in the name of every other file of a locale, by locale. In a
   * build that names each file by its own hash, the token in the name of the
   * locale's map of those hashes.
   */
  v: Record<string, string>;
  /** The key of the maps, in a build that has them */
  k?: string;
  /**
   * In a build that splits by module, where `f` and `h` are of the locale's
   * map: the hash in the name of each file the entry holds, by locale and key
   */
  e?: Record<string, Record<string, string> | undefined>;
  /**
   * The key of the file that says what the locale's files are named by in
   * the build the host serves now
   */
  n?: string;
  /** What says how this build assigned messages to files */
  c?: string;
  /** The key of the unsplit file, in a build that has unsplit messages */
  u?: string;
  /** The hash in the name of the unsplit file, by locale */
  o?: Record<string, string>;
};

/**
 * What a build that splits translations wrote, for the server of an app that
 * renders its pages before a browser loads them. With a locale's catalog and
 * the client chunks a response loads, it says which translations the page
 * needs before it hydrates and how its loader finds the rest. It holds no
 * translation and nothing of how a translations file is laid out, so it is
 * the same for every locale. Plain JSON.
 *
 * A message is named here by what its call sites pass: its hash, or in a
 * build with hash minification an id, whose hash is in `hashes`.
 */
export type SplitTranslationsOutput = {
  /** By the file of each entry chunk */
  entries: Record<
    string,
    {
      /** What the loader of a page that starts from this entry starts with */
      state: SplitTranslationsState;
      /** The messages of the entry chunk and of what it imports statically, in a build that splits by chunk */
      messages: string[];
      /** The keys of the files the entry holds before any code runs, in a build that splits by module */
      files: string[];
    }
  >;
  /** The keys of the files the import of each chunk needs, by the file of the imported chunk */
  imports: Record<string, string[]>;
  /** The messages of each file, by its key */
  files: Record<string, string[]>;
  /** The hash of each id, in a build with hash minification */
  hashes?: Record<string, string>;
  /**
   * The hashes of the unsplit messages: those the build could tie to no
   * chunk, which every page loads
   */
  unsplit: string[];
};
