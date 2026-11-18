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

export type LogLevel = NonNullable<GTCompilerOptions['logLevel']>;

/** A complete or partial gt.config.json accepted by compiler integrations. */
export type GTConfig = Partial<SharedGTConfig>;

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
   * policy blocks it, messages render the source text. Source maps are not
   * kept accurate yet for the chunks the build rewrites after the bundler has
   * rendered them: those that hold a dynamic import or the call that starts
   * the app. Splits `<T>` and `t`
   * templates from `gt-react` by chunk; the translations of other
   * messages, such as `msg` and dictionaries, stay in one file per
   * locale that the page loads when the app starts, and the build says how
   * many those are. Defaults to the `GT_CHUNK_TRANSLATIONS` environment
   * variable (`true` or `false`).
   */
  experimentalChunkTranslations?: boolean;
  /**
   * Experimental, with `experimentalChunkTranslations`: how the translation
   * files of chunks are named.
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
   *
   * Defaults to the `GT_CHUNK_TRANSLATIONS_NAMING` environment variable.
   */
  experimentalChunkTranslationsNaming?: ChunkTranslationsNaming;
  /**
   * Experimental, with `experimentalChunkTranslations`: what decides which
   * messages share a translations file.
   *
   * - `'chunk'` (the default): the chunk their call sites are in. A page
   *   loads the translations of every chunk it loads, whole.
   * - `'module'`: the modules each entry and each dynamic import can reach
   *   through static imports. A page loads the translations of the modules it
   *   reaches and not of the others the bundler packed into the same chunks,
   *   in files that hold what the same imports need, merged while a request
   *   saved is worth the bytes it adds (see
   *   `experimentalChunkTranslationsRequestCost`). Such a build names its
   *   files by `'map'`, and each locale's map says which files an import
   *   needs. It gains the most when a module runs when it is first imported
   *   (Rolldown's `output.strictExecutionOrder`); when every module of a
   *   chunk runs as the chunk loads, a page also loads what those modules
   *   could read then, and the build says so.
   *
   * Defaults to the `GT_CHUNK_TRANSLATIONS_SPLIT` environment variable.
   */
  experimentalChunkTranslationsSplit?: ChunkTranslationsSplit;
  /**
   * Experimental, with `experimentalChunkTranslationsSplit: 'module'`: what
   * one more request for a translations file is worth, in bytes of a
   * compressed download. Two files are merged while that saves a page more
   * than the bytes it then downloads without needing them.
   *
   * A lower cost is not a better split. At zero nothing is merged that
   * costs a page a byte, so an app has many small files: a page makes many
   * more requests, and every translated page downloads a larger map, which
   * names them all. Lower it only after measuring what pages then load.
   *
   * Defaults to the `GT_CHUNK_TRANSLATIONS_REQUEST_COST` environment
   * variable, else to 8192.
   */
  experimentalChunkTranslationsRequestCost?: number;
  /**
   * Experimental, with `experimentalChunkTranslationsSplit: 'module'`: the
   * path of the `gt-chunk-translations.json` that the build before this one
   * wrote. Messages then stay in the file they were in where that still
   * fits, so a change to the app renames few translation files. Defaults to
   * the `GT_CHUNK_TRANSLATIONS_PREVIOUS` environment variable.
   */
  experimentalChunkTranslationsPrevious?: string;
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
