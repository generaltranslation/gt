/**
 * Configuration types for the GT Babel plugin
 */

import type {
  GTCompilerOptions,
  GTConfig as SharedGTConfig,
  TranslationSplittingStrategy,
} from 'generaltranslation/types';
import {
  resolveTranslationSplitting,
  resolveTranslationSplittingValue,
} from 'generaltranslation/internal';
import {
  defaultEnableI18nCookieName,
  defaultLocaleCookieName,
} from 'gt-i18n/internal/cookies';
import { COMPILER_DIAGNOSTIC_SOURCE } from './utils/diagnostics';

export type LogLevel = NonNullable<GTCompilerOptions['logLevel']>;

/** Build options for the `'locale-twins'` translation splitting strategy. */
export type LocaleTwinsOptions = {
  /** What a missing translation does to the build (default: `'warn'`). */
  missingTranslations?: 'warn' | 'error';
  /** How the SPA document loads the locale's entry twin (default: `'inline'`). */
  spaBootstrap?: 'inline' | 'external';
  /** Add a default vendor chunk so library code stays shared (default: `true`). */
  vendorChunk?: boolean;
  /**
   * Locale cookie the SPA bootstrap reads. Set it when the app passes a
   * custom `localeCookieName` to GT (default: the canonical GT locale cookie).
   */
  localeCookieName?: string;
  /**
   * Enable-i18n cookie the SPA bootstrap reads. Set it when the app passes a
   * custom `enableI18nCookieName` to GT (default: the canonical GT
   * enable-i18n cookie).
   */
  enableI18nCookieName?: string;
};

/** {@link LocaleTwinsOptions} with every default applied. */
export type ResolvedLocaleTwinsOptions = Required<LocaleTwinsOptions>;

export const DEFAULT_LOCALE_TWINS_OPTIONS: ResolvedLocaleTwinsOptions = {
  missingTranslations: 'warn',
  spaBootstrap: 'inline',
  vendorChunk: true,
  localeCookieName: defaultLocaleCookieName,
  enableI18nCookieName: defaultEnableI18nCookieName,
};

/** A complete or partial gt.config.json accepted by compiler integrations. */
export type GTConfig = Partial<SharedGTConfig>;

/**
 * Plugin configuration options (from babel config)
 */
export interface PluginConfig extends GTCompilerOptions {
  /** GT Configuration object — pass the parsed gt.config.json to sync settings */
  gtConfig?: GTConfig;
  /** Enable macro transform (t`...`, t(`...`), t("a" + b)) */
  enableMacroTransform?: boolean;
  /** Name of the string translation macro function */
  stringTranslationMacro?: string;
  /** Package source for components inserted by Auto JSX Injection */
  autoJsxImportSource?: string;
  /** Automatically treat interpolated/concatenated values as derive() calls */
  autoderive?: boolean | { jsx?: boolean; strings?: boolean };
  /** Emit compiler-injected gt-react imports from gt-react/browser */
  legacyGtReactImportSource?: boolean;
  /** Debug: write a hash → jsxChildren manifest file on build */
  _debugHashManifest?: boolean;
  /** Dev hot reload: inject runtime translate calls and enable Suspense-based <T> */
  devHotReload?: boolean | { strings?: boolean; jsx?: boolean };
  /** Translation splitting strategy. Overrides gt.config.json `files.gt.splitting` (default: `'locale'`) */
  splitting?: TranslationSplittingStrategy;
  /** Build options used when `splitting` is `'locale-twins'` */
  localeTwins?: LocaleTwinsOptions;
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
  autoJsxImportSource?: string;
  /** Automatically treat interpolated/concatenated values as derive() calls */
  autoderive: { jsx: boolean; strings: boolean };
  /** Emit compiler-injected gt-react imports from gt-react/browser */
  legacyGtReactImportSource: boolean;
  /** Debug: write a hash → jsxChildren manifest file on build */
  _debugHashManifest: boolean;
  /** Dev hot reload: inject runtime translate calls and enable Suspense-based <T> */
  devHotReload: { strings: boolean; jsx: boolean };
  /** Resolved translation splitting strategy (plugin option > gt.config.json > `'locale'`) */
  splitting: TranslationSplittingStrategy;
  /** Resolved locale twins build options */
  localeTwins: ResolvedLocaleTwinsOptions;
  /**
   * Remove attributed source-locale text from the module (locale twins mode,
   * client production builds only). Set per transform from the bundler
   * environment, never from user options.
   */
  stripSourceText: boolean;
}

/**
 * Resolves the translation splitting strategy and locale twins options.
 * The `splitting` plugin option overrides gt.config.json `files.gt.splitting`;
 * `localeTwins` options are merged over {@link DEFAULT_LOCALE_TWINS_OPTIONS}.
 * Throws a diagnostic error for an unknown strategy.
 */
export function resolveLocaleTwinsSettings(
  options: Pick<PluginConfig, 'splitting' | 'localeTwins' | 'gtConfig'>
): Pick<PluginSettings, 'splitting' | 'localeTwins'> {
  return {
    splitting: resolvePluginSplitting(options),
    localeTwins: {
      ...DEFAULT_LOCALE_TWINS_OPTIONS,
      ...definedValues(options.localeTwins ?? {}),
    },
  };
}

function resolvePluginSplitting(
  options: Pick<PluginConfig, 'splitting' | 'gtConfig'>
): TranslationSplittingStrategy {
  if (options.splitting === undefined) {
    return resolveTranslationSplitting(options.gtConfig);
  }
  return resolveTranslationSplittingValue(options.splitting, {
    setting: 'The splitting option',
    source: COMPILER_DIAGNOSTIC_SOURCE,
  });
}

function definedValues<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  ) as Partial<T>;
}

/**
 * Resolves the autoderive config value into separate jsx and strings flags.
 * - `true` enables both (backward compatible)
 * - `false` disables both (backward compatible)
 * - `{ jsx?: boolean; strings?: boolean }` enables selectively (missing keys default to false)
 */
export function resolveAutoderive(
  value: boolean | { jsx?: boolean; strings?: boolean } | undefined
): { jsx: boolean; strings: boolean } {
  if (value === undefined || typeof value === 'boolean') {
    return { jsx: !!value, strings: !!value };
  }
  return { jsx: value.jsx ?? false, strings: value.strings ?? false };
}

/**
 * Resolves the devHotReload config value into separate strings and jsx flags.
 * - `true` enables strings only (JSX is handled at runtime via Suspense, no compiler injection needed)
 * - `false` disables both
 * - `{ strings?: boolean; jsx?: boolean }` enables selectively (missing keys default to false)
 */
export function resolveDevHotReload(
  value: boolean | { strings?: boolean; jsx?: boolean } | undefined
): { strings: boolean; jsx: boolean } {
  if (value === undefined || typeof value === 'boolean') {
    return { strings: !!value, jsx: false };
  }
  return { strings: value.strings ?? false, jsx: value.jsx ?? false };
}
