/**
 * Configuration types for the GT Babel plugin
 */

import type {
  ChunkTranslations,
  ChunkTranslationsNaming,
  ChunkTranslationsSplit,
} from './transform/chunk-translations/resolveChunkTranslations';
import type {
  GTCompilerOptions,
  GTConfig as SharedGTConfig,
  GTParsingFlags,
} from 'generaltranslation';
import type { SplitTranslationsOutput } from 'generaltranslation/internal';

export type LogLevel = NonNullable<GTCompilerOptions['logLevel']>;

/** A complete or partial gt.config.json accepted by compiler integrations. */
export type GTConfig = Partial<SharedGTConfig>;

/** The keys of the `experimentalSplitTranslations` option. */
export type SplitTranslationsOptions = {
  /**
   * Whether the build splits translations. Defaults to the
   * `GT_SPLIT_TRANSLATIONS` environment variable (`true` or `false`), else
   * to true.
   */
  enabled?: boolean;
  /**
   * What decides which messages share a translations file.
   *
   * - `'chunk'` (the default): the chunk their call sites are in. A page
   *   loads the translations of every chunk it loads, whole.
   * - `'module'`: the modules each entry and each dynamic import can reach
   *   through static imports. A page loads the translations of the modules it
   *   reaches and not of the others the bundler packed into the same chunks,
   *   in files that hold what the same imports need, merged while a request
   *   saved is worth the bytes it adds (see `requestCost`). Such a build
   *   names its files by `'map'`, and each locale's map says which files an
   *   import needs. It gains the most when a module runs when it is first
   *   imported (Rolldown's `output.strictExecutionOrder`); when every module
   *   of a chunk runs as the chunk loads, a page also loads what those
   *   modules could read then, and the build says so.
   *
   * Defaults to the `GT_SPLIT_TRANSLATIONS_BY` environment variable.
   */
  by?: ChunkTranslationsSplit;
  /**
   * Hash minification. A hash is random and does not compress, and it is
   * most of what a message costs a page beyond its text. With this on, the
   * call sites the build splits by chunk or by module pass an id in place of
   * their hash, and the translation files of chunks are keyed by it, which
   * makes both smaller. An id is 8 characters that name the list of its
   * chunk's messages, a digest of their hashes in the order of the hashes,
   * then a `.` and the place of its message in that list, as `kR3_x0Qa.12`.
   * Every call site of a chunk repeats those characters, so they compress
   * to little. An id still follows from content alone: the same id names
   * the same message in every build. A chunk's ids change only when the set
   * of its own messages does, and a message that several chunks read has an
   * id in each. The build writes the ids into every chunk that holds one of
   * those call sites after the bundler has rendered it, and the chunk's
   * source map follows them.
   *
   * The hash of a message stays what it is everywhere else: in the
   * translation files at `files.gt.output`, in the unsplit file, and at
   * every call site that reads from it. A call site whose hash is computed
   * when it runs finds a message that a compiled call site also reads only
   * where the build could tell which message that is; it warns of the
   * modules where it could not. The build fails when two lists of messages
   * would share a name, when an id is already a key of the translation
   * files, and when a chunk reaches the output with its hashes not
   * minified. Cannot be used with `_tagIds`. Defaults to the
   * `GT_MINIFY_HASHES` environment variable.
   */
  minifyHashes?: boolean;
  /**
   * How the translation files of chunks are named.
   *
   * - `'token'` (the default): by one token per locale, which the page holds.
   *   A file's URL follows from its chunk's, so the page requests the files
   *   of the chunks it preloads without waiting for anything. Any change to a
   *   locale's translations renames all of that locale's files, and so does
   *   any change to JavaScript that renames a chunk, as a bundler names a
   *   chunk by its content and by the chunks it imports.
   * - `'map'`: each by the locale and the hash of its own content alone, with
   *   one small map per locale that the page requests first, which says
   *   which file is each chunk's. A changed translation renames only the
   *   files it is in and the map, a change to JavaScript alone only the map,
   *   and the files of chunks wait for the map. The naming for an app that
   *   deploys often.
   */
  naming?: ChunkTranslationsNaming;
  /**
   * With `by: 'module'`: what one more request for a translations file is
   * worth, in bytes of a compressed download. Two files are merged while
   * that saves a page more than the bytes it then downloads without needing
   * them.
   *
   * A lower cost is not a better split. At zero nothing is merged that
   * costs a page a byte, so an app has many small files: a page makes many
   * more requests, and every translated page downloads a larger map, which
   * names them all. Lower it only after measuring what pages then load.
   *
   * Defaults to 8192.
   */
  requestCost?: number;
  /**
   * With `by: 'module'`: the path of the `gt-chunk-translations.json` that
   * the build before this one wrote. Messages then stay in the file they
   * were in where that still fits, so a change to the app renames few
   * translation files.
   */
  previous?: string;
};

/**
 * What the plugin of a framework that renders an app on a server tells a
 * build that splits translations, and is told by it. Such an app has no
 * `initializeGTSPA`: the framework's runtime starts the loader in each page
 * with what its server sent. So the build looks for no `initializeGTSPA`, and
 * fails on a dynamic import that loads translated chunks and that it could
 * not wrap, where a client-rendered app is warned.
 */
export type SplitTranslationsHost = {
  /**
   * The module that compiled code imports the loader of translation files
   * from: an entry of the framework's package that exports what
   * `gt-react/chunk-translations` does. An app resolves its framework's
   * package, and not always gt-react.
   */
  loader: string;
  /**
   * The names of the Vite environments whose chunks a browser loads. Only
   * those are split. Every other, as one built for a server, keeps the hash
   * at each call site and reads whole catalogs.
   */
  clientEnvironments: readonly string[];
  /**
   * Called once a client environment has written its translation files, with
   * what the server needs to send a page the translations of its chunks.
   */
  onSplit: (output: SplitTranslationsOutput) => void;
  /**
   * Called once an environment that is no client's has compiled its modules,
   * with the hashes of the `msg()` messages in the modules of every such
   * environment so far. Code that only a server runs can send such a message
   * to a browser as data, where `m()` reads it by its hash, whatever file
   * the client build put a message of the same text in. So the framework
   * sends their translations with every page.
   */
  onServerMessages: (hashes: string[]) => void;
};

/**
 * Plugin configuration options (from babel config). The parsing flags override
 * the same flags in gt.config.json.
 */
export interface PluginConfig
  extends
    GTCompilerOptions,
    Pick<GTParsingFlags, 'autoderive' | 'devHotReload'> {
  /** GT Configuration object — pass the parsed gt.config.json to sync settings */
  gtConfig?: GTConfig;
  /** Package source for components inserted by Auto JSX Injection */
  autoJsxImportSource?: string;
  /** Debug: write a hash → jsxChildren manifest file on build */
  _debugHashManifest?: boolean;
  /**
   * Experimental, for production builds of single-page apps on `gt-react`
   * with Vite: writes the translations of each JavaScript
   * chunk into a JSON file per locale next to the chunk, read from the
   * translation files at `files.gt.output`. A page then loads only the
   * translations of the chunks it loads, in its own locale, and a page in the
   * default locale loads none; the locale's whole catalog is not loaded, so
   * `loadTranslations` is not called. The entry chunk's file is requested by
   * a script the build adds to `index.html`, and each dynamic import requests
   * the files of the chunks it loads together with them. That script is
   * inline: under a Content Security Policy that allows no inline script it
   * needs a nonce, which Vite's `html.cspNonce` puts on it, and where the
   * policy blocks it, messages render the source text. The build rewrites
   * chunks after the bundler has rendered them, those that hold a dynamic
   * import or the call that starts the app, and their source maps follow
   * what it rewrites. Splits `<T>` and `t`
   * templates from `gt-react` by chunk; the translations of other
   * messages, such as `msg` and dictionaries, stay in one file per
   * locale that the page loads when the app starts, and the build says how
   * many those are.
   *
   * The JSON files are assets named by what they hold, as the chunks are:
   * deploy them with the chunks they sit next to and keep them as long. A
   * page that stays open while the app is deployed again asks for files by
   * the names its own build gave them. On a host that drops the files of
   * earlier builds it then reads `gt-current.json`, which every build
   * writes under that one name, to find a file under its current name, so
   * serve that file as `index.html` is served, not cached for good. A host
   * that caches the assets directory for good and ignores the query the page
   * adds serves a stale copy: the page then finds no current name, and the
   * messages of the missing file render the source text, with a warning.
   *
   * A key set here overrides its environment variable, which is read only
   * for a key that is left out: `GT_SPLIT_TRANSLATIONS` for `enabled`,
   * `GT_SPLIT_TRANSLATIONS_BY` for `by` and `GT_MINIFY_HASHES` for
   * `minifyHashes`. The other keys have no environment variable. An empty
   * variable is not set. With neither `enabled` nor `GT_SPLIT_TRANSLATIONS`
   * set, the split is on when the option is set and off when it is not.
   * While the split is off, the other keys and their variables are not read.
   */
  experimentalSplitTranslations?: SplitTranslationsOptions;
  /**
   * Set by the plugin of a framework that renders the app on a server, not by
   * an app: how a build that splits translations fits that framework. See
   * `SplitTranslationsHost`.
   */
  splitTranslationsHost?: SplitTranslationsHost;
  /**
   * Replaces each static `t` template with a call
   * that passes its message, built at compile time and written at the call,
   * so the call site builds no message tree when it renders. An older
   * `t` does not read these calls, so the default is true only for a file
   * whose GT runtime is found and reads them; false keeps the tagged
   * templates and only injects their hashes.
   */
  precomputeMessages?: boolean;
}

/**
 * Internal plugin settings (processed config)
 */
export interface PluginSettings {
  logLevel: LogLevel;
  compileTimeHash: boolean;
  disableBuildChecks: boolean;
  filename?: string;
  /** Enable Auto Jsx Injection (e.g. <div>Hello</div> -> <div><T>Hello</T></div>) */
  enableAutoJsxInjection: boolean;
  /** Package source for components inserted by Auto JSX Injection */
  autoJsxImportSource: string;
  /** Automatically treat interpolated values in <T> as derive() calls */
  autoderive: { jsx: boolean };
  /** Debug: write a hash → jsxChildren manifest file on build */
  _debugHashManifest: boolean;
  /** Dev hot reload: inject runtime translate calls for <T> content */
  devHotReload: { jsx: boolean };
  /** Set when a build writes translations per chunk, which the build then splits */
  chunkTranslations?: ChunkTranslations;
  /** Set in an environment such a build does not split: where the hashes of its msg() messages go */
  serverMessages?: Set<string>;
  /** Replace static t templates with calls that read a precomputed message */
  precomputeMessages: boolean;
}

/**
 * Resolves the devHotReload config value. `{ jsx: true }` injects runtime
 * translate calls; without it, JSX is translated at runtime through Suspense
 * and needs no compiler injection.
 */
export function resolveDevHotReload(value: GTParsingFlags['devHotReload']): {
  jsx: boolean;
} {
  return { jsx: value?.jsx === true };
}
