/**
 * Configuration types for the GT Babel plugin
 */

import type { InlineTranslationsTable } from './transform/injection/inline-translations/loadInlineTranslations';
import type { SourceReplacement } from './transform/injection/inline-translations/resolveSourceReplacement';
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
   * Experimental, for apps whose messages are all `<T>` and tagged templates
   * from an `/unstable` entry point: leaves the ICU message string parser out
   * of a production bundle, which formats message trees and JSX without it.
   * A module that imports something that works with ICU strings, such as the
   * stable `useGT()`, `msg()` or `t()`, fails the build, and so does one that
   * takes a whole stable entry point (`import * as`, `export *`, `import()`,
   * `require()`): import by name. Defaults to the `GT_OMIT_ICU_PARSER`
   * environment variable (`true` or `false`).
   */
  experimentalOmitIcuParser?: boolean;
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
  /** `files.gt.inlineTranslations.helpers`: also embed templates that use helpers */
  inlineTranslationsHelpers: boolean;
  /** Set when a per-locale build replaces source content with its translations */
  sourceReplacement?: SourceReplacement;
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
