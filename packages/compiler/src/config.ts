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
  /** Debug: write a hash → jsxChildren manifest file on build */
  _debugHashManifest?: boolean;
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
  /** Debug: write a hash → jsxChildren manifest file on build */
  _debugHashManifest: boolean;
}
