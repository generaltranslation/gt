/**
 * Configuration types for the GT Babel plugin
 */

import type { InlineTranslationsTable } from './transform/injection/inline-translations/loadInlineTranslations';
import type { SourceReplacement } from './transform/injection/inline-translations/resolveSourceReplacement';
import type { StaticRuntime } from './transform/static-runtime/resolveStaticRuntime';
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
  /** Enable macro transform (t`...`, t(`...`), t("a" + b)) */
  enableMacroTransform?: boolean;
  /** Name of the string translation macro function */
  stringTranslationMacro?: string;
  /** Package source for components inserted by Auto JSX Injection */
  autoJsxImportSource?: string;
  /** Debug: write a hash → jsxChildren manifest file on build */
  _debugHashManifest?: boolean;
  /**
   * Experimental: build a single-page app for a single locale. Embedded
   * translations (`files.gt.inlineTranslations`) keep only this locale's
   * strings, so each per-locale build ships one language and a server picks the
   * build per request. Server-rendered apps, including Next.js, are not
   * supported. Defaults to the `GT_STATIC_LOCALE` environment variable. A source
   * locale, or a locale that is not embedded, embeds no translations. Unset
   * embeds every configured locale.
   */
  experimentalStaticLocale?: string;
  /**
   * Experimental, for per-locale builds of single-page apps
   * (`experimentalStaticLocale`): replaces the source content of each call site
   * that embeds a translation with the static locale's translation, so those
   * call sites ship no source text and need no lookup. `<T>` becomes the JSX
   * its translation renders and an unstable `t` or `gt` template becomes the
   * translated template, or the translated text itself when it has no
   * variables; a call site whose translation does not match its source keeps
   * the embedded translation. For a source locale, `<T>` becomes the JSX of
   * its own children and a template without variables becomes its text.
   * Defaults to the `GT_REPLACE_SOURCE` environment variable (`true` or
   * `false`).
   */
  experimentalReplaceSource?: boolean;
  /**
   * Experimental, for per-locale builds of single-page apps that replace
   * source content (`experimentalStaticLocale` with
   * `experimentalReplaceSource`): leaves the GT runtime out of the build. The
   * compiler resolves every `t` template from `gt-react/unstable` and every
   * `<T>` for the build's locale, and a template with variables formats its
   * message through `gt-react/static-runtime`, which loads no translations
   * and reads no locale. `initializeGTSPA()` becomes a call that does
   * nothing. Anything that would still need the runtime, such as `useGT()`,
   * `msg()`, a `GTProvider`, the locale hooks, or a `<T>` the build cannot
   * replace, fails the build with its location. Defaults to the
   * `GT_STATIC_RUNTIME` environment variable (`true` or `false`).
   */
  experimentalStaticRuntime?: boolean;
}

/**
 * Internal plugin settings (processed config)
 */
export interface PluginSettings {
  logLevel: LogLevel;
  compileTimeHash: boolean;
  disableBuildChecks: boolean;
  filename?: string;
  enableMacroTransform: boolean;
  stringTranslationMacro: string;
  enableTaggedTemplate: boolean;
  enableTemplateLiteralArg: boolean;
  enableConcatenationArg: boolean;
  enableMacroImportInjection: boolean;
  /** Enable Auto Jsx Injection (e.g. <div>Hello</div> -> <div><T>Hello</T></div>) */
  enableAutoJsxInjection: boolean;
  /** Package source for components inserted by Auto JSX Injection */
  autoJsxImportSource: string;
  /** Automatically treat interpolated/concatenated values as derive() calls */
  autoderive: { jsx: boolean; strings: boolean };
  /** Debug: write a hash → jsxChildren manifest file on build */
  _debugHashManifest: boolean;
  /** Dev hot reload: inject runtime translate calls and enable Suspense-based <T> */
  devHotReload: { strings: boolean; jsx: boolean };
  /** Resolved translations to embed at call sites, keyed by locale then hash */
  inlineTranslationsTable?: InlineTranslationsTable;
  /** Set when a per-locale build replaces source content with its translations */
  sourceReplacement?: SourceReplacement;
  /** Set when a build leaves the GT runtime out and formats with the static entry */
  staticRuntime?: StaticRuntime;
}

/**
 * Resolves the devHotReload config value into separate strings and jsx flags.
 * - `true` enables strings only (JSX is handled at runtime via Suspense, no compiler injection needed)
 * - `false` disables both
 * - `{ strings?: boolean; jsx?: boolean }` enables selectively (missing keys default to false)
 */
export function resolveDevHotReload(value: GTParsingFlags['devHotReload']): {
  strings: boolean;
  jsx: boolean;
} {
  if (value === undefined || typeof value === 'boolean') {
    return { strings: !!value, jsx: false };
  }
  return { strings: value.strings ?? false, jsx: value.jsx ?? false };
}
