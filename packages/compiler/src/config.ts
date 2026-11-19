/**
 * Configuration types for the GT Babel plugin
 */

import type {
  ChunkTranslations,
  ChunkTranslationsNaming,
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
   * with Vite, Rollup or Rolldown: writes the translations of each JavaScript
   * chunk into a JSON file per locale next to the chunk, read from the
   * translation files at `files.gt.output`. A page then loads only the
   * translations of the chunks it loads, in its own locale, and a page in the
   * default locale loads none; the locale's whole catalog is not loaded, so
   * `loadTranslations` is not called. The entry chunk's file is requested by
   * a script the build adds to `index.html`, and each dynamic import requests
   * the files of the chunks it loads together with them. That script is
   * inline: under a Content Security Policy that allows no inline script it
   * needs a nonce, which Vite's `html.cspNonce` puts on it, and where the
   * policy blocks it, messages render the source text. Splits `<T>` and `t`
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
