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
        autoderive?: boolean | { jsx?: boolean; strings?: boolean };
        /** @deprecated Use `autoderive` instead */
        autoDerive?: boolean;
        /** Enable dev hot reload runtime translate injection */
        devHotReloadEnabled?: boolean;
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
  /** Automatically treat interpolated/concatenated values as derive() calls */
  autoderive?: boolean | { jsx?: boolean; strings?: boolean };
  /** @deprecated Use `autoderive` instead */
  autoDerive?: boolean;
  /** Debug: write a hash → jsxChildren manifest file on build */
  _debugHashManifest?: boolean;
  /** Enable dev hot reload runtime translate injection */
  devHotReloadEnabled?: boolean;
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
  /** Automatically treat interpolated/concatenated values as derive() calls */
  autoderive: { jsx: boolean; strings: boolean };
  /** Debug: write a hash → jsxChildren manifest file on build */
  _debugHashManifest: boolean;
  /** Enable dev hot reload runtime translate injection */
  devHotReloadEnabled: boolean;
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
