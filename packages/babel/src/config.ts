/**
 * Configuration types for the GT Babel plugin
 */

export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug';

/**
 * Plugin configuration options (from babel config)
 */
export interface PluginConfig {
  /** Log level for the plugin */
  logLevel?: LogLevel;
  /** Enable compile-time hash generation */
  compileTimeHash?: boolean;
  /** Disable dynamic content validation checks */
  disableBuildChecks?: boolean;
}

/**
 * Internal plugin settings (processed config)
 */
export interface PluginSettings {
  logLevel: LogLevel;
  compileTimeHash: boolean;
  disableBuildChecks: boolean;
  filename?: string;
}
