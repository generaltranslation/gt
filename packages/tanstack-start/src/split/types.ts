import type { ChunkTranslationsState } from 'gt-react/chunk-translations';

/** What gt-react's loader of split translations starts a page with. */
export type SplitStartState = Pick<
  ChunkTranslationsState,
  'b' | 'f' | 'h' | 'v' | 'e' | 'n' | 'c' | 'u' | 'o'
>;

/**
 * What the client build wrote, as the server build reads it. The Vite plugin
 * generates it from the `gt-chunk-translations.json` of the client build.
 */
export type SplitTable = {
  /** How the translations of a first visit reach the page */
  firstVisit: 'inline' | 'files';
  split: 'chunk' | 'module';
  /** The URL the client build's files are served from */
  base: string;
  /** The start state of each locale that has files */
  states: Record<string, SplitStartState>;
  /** The keys of the files the import of a chunk needs, by the chunk's file */
  imports: Record<string, string[]>;
  /** The name of each file, by its key and locale */
  files: Record<string, Record<string, string>>;
  /** The file the page reads first, by locale: the entry's, or the locale's map */
  entry: Record<string, string>;
  /** The file of the entry chunk */
  entryChunk: string;
  /** In a build that splits by module: the keys of the files the entry holds */
  entryKeys: string[];
  /** The unsplit file, by locale */
  unsplit: Record<string, string>;
};

/** The content of each file of a locale, by the file's name. */
export type SplitContents = Record<string, unknown>;

/**
 * What the server sends with a page, in the router's dehydrated state: `s`,
 * `c` and `k` with a page it rendered for a request, or `a` with a
 * prerendered shell, which every visitor gets whatever their locale.
 */
export type SplitPayload = {
  /** The split of the build */
  m: SplitTable['split'];
  /** The start state of the request's locale */
  s?: SplitStartState;
  /** The start state of each locale that has files */
  a?: Record<string, SplitStartState>;
  /** The chunks of the matched routes, whose imports need the files in `k` */
  c?: string[];
  /** The keys of the files the page needs before it hydrates, beyond the entry's file */
  k?: string[];
  /** `inline`: the content of the entry's file, of the unsplit file, and of each file in `k` */
  t?: { e?: unknown; u?: unknown; f: Record<string, unknown> };
  /** `files`: the URLs the server asked the browser to preload */
  p?: string[];
};

/** What the server reads of a router to find the chunks of the matched routes. */
export type SplitRouter = {
  state?: { matches?: readonly { routeId: string }[] };
  ssr?: {
    manifest?: {
      routes?: Record<
        string,
        { preloads?: readonly (string | { href: string })[] } | undefined
      >;
    };
  };
};
