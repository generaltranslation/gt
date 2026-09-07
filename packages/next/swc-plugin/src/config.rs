use crate::auto_jsx::JsxRuntime;
use crate::logging::LogLevel;
use serde::Deserialize;

// For plugin configuration and settings
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginSettings {
  /// Log level for the plugin
  #[serde(default)]
  pub log_level: LogLevel,
  /// Experimental feature: inject compile-time hash attributes
  #[serde(default)]
  pub compile_time_hash: bool,
  /// Optional filename for better error messages
  #[serde(default)]
  pub filename: Option<String>,
  /// Disable dynamic content check
  #[serde(default)]
  pub disable_build_checks: bool,
  /// When true, bare variables/calls in JSX expression containers are allowed
  #[serde(default)]
  pub autoderive_jsx: bool,
  /// When true, bare variables/calls in template literals and concatenations are allowed
  #[serde(default)]
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
  /// Internal package identities supplied by withGTConfig to avoid translating
  /// the implementation of the GT runtime itself.
  #[serde(default)]
  pub auto_jsx_runtime_package_roots: Vec<String>,
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

impl PluginConfig {
  /// Auto-only configuration must not invalidate existing compiler settings
  /// unless automatic insertion is explicitly enabled. Parse the original JSON
  /// in both branches so duplicate or malformed legacy fields keep their
  /// pre-feature fallback behavior.
  pub fn parse(input: &str) -> Self {
    let enabled = serde_json::from_str::<serde_json::Value>(input)
      .ok()
      .and_then(|value| {
        value
          .get("enableAutoJsxInjection")
          .and_then(|value| value.as_bool())
      })
      == Some(true);
    if enabled {
      return serde_json::from_str(input).unwrap_or_default();
    }
    let Ok(settings) = serde_json::from_str::<PluginSettings>(input) else {
      return Self::default();
    };
    Self {
      log_level: settings.log_level,
      compile_time_hash: settings.compile_time_hash,
      filename: settings.filename,
      disable_build_checks: settings.disable_build_checks,
      autoderive_jsx: settings.autoderive_jsx,
      autoderive_strings: settings.autoderive_strings,
      ..Self::default()
    }
  }
}

impl Default for PluginConfig {
  fn default() -> Self {
    Self {
      log_level: LogLevel::Warn,
      compile_time_hash: false,
      enable_auto_jsx_injection: false,
      auto_jsx_runtime_package_roots: Vec::new(),
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
