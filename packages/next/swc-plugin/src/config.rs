use crate::auto_jsx::JsxRuntime;
use crate::logging::LogLevel;
use serde::Deserialize;

// For plugin configuration and settings
#[derive(Debug)]
pub struct PluginSettings {
  /// Log level for the plugin
  pub log_level: LogLevel,
  /// Experimental feature: inject compile-time hash attributes
  pub compile_time_hash: bool,
  /// Optional filename for better error messages
  pub filename: Option<String>,
  /// Disable dynamic content check
  pub disable_build_checks: bool,
  /// When true, bare variables/calls in JSX expression containers are allowed
  pub autoderive_jsx: bool,
  /// When true, bare variables/calls in template literals and concatenations are allowed
  pub autoderive_strings: bool,
}

impl PluginSettings {
  pub fn new(log_level: LogLevel, compile_time_hash: bool, filename: Option<String>, disable_build_checks: bool, autoderive_jsx: bool, autoderive_strings: bool) -> Self {
    Self {
      log_level,
      compile_time_hash,
      filename,
      disable_build_checks,
      autoderive_jsx,
      autoderive_strings,
    }
  }
}

/// Plugin configuration options
#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PluginConfig {
  #[serde(default)]
  pub log_level: LogLevel,
  #[serde(default)]
  pub compile_time_hash: bool,
  /// Insert automatic JSX translation components before hash collection.
  #[serde(default)]
  pub enable_auto_jsx_injection: bool,
  /// Internal host context; per-file JSX pragmas take precedence.
  #[serde(default)]
  pub jsx_import_source: Option<String>,
  #[serde(default)]
  pub jsx_runtime: Option<JsxRuntime>,
  /// The owned loader supplies per-graph JSX context in a trailing statement.
  #[serde(default)]
  pub jsx_import_source_from_loader: bool,
  /// Preformatted by the Next.js configuration adapter's diagnostic helper.
  #[serde(default)]
  pub missing_jsx_runtime_context_diagnostic: Option<String>,
  #[serde(default)]
  pub filename: Option<String>,
  #[serde(default)]
  pub disable_build_checks: bool,
  #[serde(default)]
  pub autoderive_jsx: bool,
  #[serde(default)]
  pub autoderive_strings: bool,
}

impl Default for PluginConfig {
  fn default() -> Self {
    Self {
      log_level: LogLevel::Warn,
      compile_time_hash: false,
      enable_auto_jsx_injection: false,
      jsx_import_source: None,
      jsx_runtime: None,
      jsx_import_source_from_loader: false,
      missing_jsx_runtime_context_diagnostic: None,
      filename: None,
      disable_build_checks: false,
      autoderive_jsx: false,
      autoderive_strings: false,
    }
  }
}
