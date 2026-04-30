/**
 * Configuration types for the GT Babel plugin
 */

export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug';

/**
 * The only relevant parts of the GT config that we are concerned with
 */
type GTConfig = {
  files?: {
    gt?: {
      parsingFlags?: {
        enableAutoJsxInjection?: boolean;
        enableCrossFileResolution?: boolean;
        autoderive?: boolean | { jsx?: boolean; strings?: boolean };
        /** @deprecated Use `autoderive` instead */
        autoDerive?: boolean;
        /** Dev hot reload: inject runtime translate calls and enable Suspense-based <T> */
        devHotReload?: boolean | { strings?: boolean; jsx?: boolean };
      };
    };
  };
};

/**
 * Plugin configuration options (from babel config)
 */
export interface PluginConfig {
  /** Log level for the plugin */
  logLevel?: LogLevel;
  /** GT Configuration object — pass the parsed gt.config.json to sync settings */
  gtConfig?: GTConfig;
  /** Enable compile-time hash generation */
  compileTimeHash?: boolean;
  /** Disable dynamic content validation checks */
  disableBuildChecks?: boolean;
  /** Enable macro transform (t`...`, t(`...`), t("a" + b)) */
  enableMacroTransform?: boolean;
  /** Name of the string translation macro function */
  stringTranslationMacro?: string;
  /** Enable Auto Jsx Injection (e.g. <div>Hello</div> -> <div><T>Hello</T></div>) */
  enableAutoJsxInjection?: boolean;
  /** Enable cross-file import resolution for compiler analysis */
  enableCrossFileResolution?: boolean;
  /** Automatically treat interpolated/concatenated values as derive() calls */
  autoderive?: boolean | { jsx?: boolean; strings?: boolean };
  /** @deprecated Use `autoderive` instead */
  autoDerive?: boolean;
  /** Debug: write a hash → jsxChildren manifest file on build */
  _debugHashManifest?: boolean;
  /** Dev hot reload: inject runtime translate calls and enable Suspense-based <T> */
  devHotReload?: boolean | { strings?: boolean; jsx?: boolean };
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
  /** Enable cross-file import resolution for compiler analysis */
  enableCrossFileResolution: boolean;
  /** Automatically treat interpolated/concatenated values as derive() calls */
  autoderive: { jsx: boolean; strings: boolean };
  /** Debug: write a hash → jsxChildren manifest file on build */
  _debugHashManifest: boolean;
  /** Dev hot reload: inject runtime translate calls and enable Suspense-based <T> */
  devHotReload: { strings: boolean; jsx: boolean };
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
 * Resolves the cross-file resolution flag from plugin options or gt.config.
 * Plugin options take precedence over gt.config parsing flags.
 */
export function resolveEnableCrossFileResolution(
  options: PluginConfig
): boolean {
  return (
    options.enableCrossFileResolution ??
    options.gtConfig?.files?.gt?.parsingFlags?.enableCrossFileResolution ??
    false
  );
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
